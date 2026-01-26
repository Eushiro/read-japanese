/**
 * Custom ESLint plugin to catch untranslated strings in i18n interpolation.
 *
 * Catches patterns like:
 *   t("paywall.actionMessage", { action: "stories" })
 *
 * Allows:
 *   t("key", { count: 5 })           // numbers
 *   t("key", { name: userName })     // variables
 *   t("key", { action: t("...") })   // translated strings
 */

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-i18n-interpolation',
    version: '1.0.0',
  },
  rules: {
    'no-literal-interpolation': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Disallow literal strings as interpolation values in translation functions',
          recommended: true,
        },
        messages: {
          literalInterpolation:
            'Avoid passing literal string "{{value}}" to translation interpolation. This will appear untranslated in other languages. Either translate it first with t() or use a translation key like t("namespace.features.{{value}}").',
        },
        schema: [
          {
            type: 'object',
            properties: {
              // Parameter names that are allowed to have literal strings
              allowedParams: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const options = context.options[0] || {}
        const allowedParams = new Set(options.allowedParams || [])

        return {
          CallExpression(node) {
            // Check if this is a t() or useT()() call
            const callee = node.callee

            // Match: t("key", { ... }) or someT("key", { ... })
            const isTFunction =
              (callee.type === 'Identifier' && callee.name === 't') ||
              (callee.type === 'Identifier' && callee.name.endsWith('T'))

            if (!isTFunction) return

            // Check if there's a second argument (interpolation object)
            const interpolationArg = node.arguments[1]
            if (!interpolationArg || interpolationArg.type !== 'ObjectExpression') return

            // Check each property in the interpolation object
            for (const prop of interpolationArg.properties) {
              // Skip spread elements
              if (prop.type !== 'Property') continue

              // Get parameter name
              const paramName =
                prop.key.type === 'Identifier'
                  ? prop.key.name
                  : prop.key.type === 'Literal'
                    ? String(prop.key.value)
                    : null

              if (!paramName) continue

              // Skip allowed parameters
              if (allowedParams.has(paramName)) continue

              // Check if value is a literal string
              const value = prop.value
              if (value.type === 'Literal' && typeof value.value === 'string') {
                // Allow empty strings
                if (value.value === '') continue

                // Allow strings that look like technical values (urls, css, etc)
                if (/^[a-z]+:\/\//.test(value.value)) continue // URLs
                if (/^#[0-9a-fA-F]+$/.test(value.value)) continue // Hex colors
                if (/^\d+(\.\d+)?(px|em|rem|%|vh|vw)$/.test(value.value)) continue // CSS units

                context.report({
                  node: value,
                  messageId: 'literalInterpolation',
                  data: { value: value.value },
                })
              }

              // Also check template literals with no expressions (effectively strings)
              if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
                const stringValue = value.quasis[0]?.value?.cooked || ''
                if (stringValue === '') continue

                context.report({
                  node: value,
                  messageId: 'literalInterpolation',
                  data: { value: stringValue },
                })
              }
            }
          },
        }
      },
    },
  },
}

export default plugin
