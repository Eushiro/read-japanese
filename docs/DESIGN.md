# SanLang Design System

## Philosophy

SanLang uses a **premium dark-first design** inspired by modern glass morphism and ambient lighting effects. The aesthetic balances:

- **Warmth**: Orange (#ff8400), yellow (#feed7a), and purple (#df91f7) accents
- **Depth**: Glass cards with backdrop blur and inner shadows
- **Motion**: Subtle animations that enhance without distracting
- **Focus**: Reduced visual noise for content consumption

---

## Color Palette

### Dark Mode (Primary)

| Token      | Value                | Usage            |
| ---------- | -------------------- | ---------------- |
| Background | #000000              | Page background  |
| Surface    | bg-white/[0.02-0.06] | Glass cards      |
| Border     | border-white/10      | Card borders     |
| Foreground | #f6f6f4              | Primary text     |
| Muted      | white/50-60          | Secondary text   |
| Accent     | #ff8400              | CTAs, highlights |
| Purple     | #df91f7              | Secondary accent |
| Yellow     | #feed7a              | Warm highlights  |

### Light Mode (Secondary)

| Token      | Value   | Usage                    |
| ---------- | ------- | ------------------------ |
| Background | #faf7f2 | Warm paper tone          |
| Surface    | #ffffff | Cards                    |
| Border     | #d4ccc0 | Subtle borders (visible) |
| Foreground | #1c1917 | Primary text             |
| Accent     | #c2410c | Vermillion               |

### Semantic Tokens (Theme-Aware)

Use these classes for automatic light/dark mode support:

- `text-foreground` instead of `text-white`
- `text-muted-foreground` instead of `text-white/50-60`
- `border-border` instead of `border-white/10`
- `bg-muted` instead of `bg-white/5`

---

## Glass Morphism Pattern

Use this pattern for elevated containers (supports both light and dark mode):

```tsx
<div className="relative rounded-2xl overflow-hidden">
  {/* Glass background - use border-border for light mode support */}
  <div className="absolute inset-0 backdrop-blur-md bg-white/[0.03] border border-border dark:border-white/10 rounded-2xl" />
  <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] rounded-2xl" />

  {/* Content */}
  <div className="relative p-6">{/* ... */}</div>
</div>
```

**Hover states (dark mode):**

- Increase background: `bg-white/[0.03]` -> `bg-white/[0.06]`
- Brighten border: `border-white/10` -> `border-white/15`
- Add glow: `shadow-[0_0_30px_rgba(255,132,0,0.1)]`

---

## Animated Backgrounds

For hero sections and full-page views, add animated gradient orbs:

```tsx
<motion.div
  className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-15"
  style={{ background: "radial-gradient(circle, #ff8400 0%, transparent 70%)" }}
  animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
  transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
/>
```

**Intensity guidelines:**

- Hero sections: opacity-20 to opacity-30
- Content pages: opacity-10 to opacity-15
- Reading/focus pages: opacity-5 to opacity-10 (minimal distraction)

---

## Typography

| Element            | Font         | Weight | Size                       |
| ------------------ | ------------ | ------ | -------------------------- |
| Display (headings) | Fraunces     | 600    | text-3xl to text-5xl       |
| Body               | Inter        | 400    | text-base to text-lg       |
| Japanese content   | Noto Sans JP | 400    | text-lg with leading-loose |
| Labels/badges      | Inter        | 500    | text-sm                    |

---

## Buttons

### Primary CTA (Gradient)

```tsx
<button
  className="group relative px-8 py-4 text-lg font-semibold text-white rounded-2xl
  bg-gradient-to-r from-yellow-400 via-orange-500 to-purple-500
  bg-[length:200%_100%] animate-gradient-x
  shadow-xl shadow-orange-500/30
  hover:shadow-2xl hover:shadow-orange-500/40
  hover:scale-[1.02] active:scale-[0.98]
  transition-all duration-300 overflow-hidden"
>
  {/* Shimmer */}
  <span
    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
    -translate-x-full group-hover:translate-x-full transition-transform duration-700"
  />
  <span className="relative">{children}</span>
</button>
```

### Glass Button

```tsx
<Button variant="glass" /> // bg-white/5 border-white/10, hover:bg-white/10
<Button variant="glass-accent" /> // Same with accent border on hover
```

---

## Spacing

| Token        | Value          | Usage                  |
| ------------ | -------------- | ---------------------- |
| Section gap  | space-y-8      | Between major sections |
| Card padding | p-6 sm:p-8     | Inside glass cards     |
| Grid gap     | gap-3 to gap-4 | Between grid items     |
| Container    | max-w-5xl      | Default content width  |

---

## Motion Principles

1. **Entrance animations**: Fade up with `y: 20 -> 0`, duration 0.5-0.6s
2. **Stagger children**: delay = index \* 0.1s
3. **Hover effects**: Scale 1.02-1.05, y: -4px lift
4. **Ease curve**: [0.19, 1, 0.22, 1] (ease-out-expo)
5. **Respect reduced motion**: Use `useReducedMotion()` hook

---

## Headers

### Sticky Page Headers (Glass)

```tsx
{/* Use semantic border and background for light mode support */}
<header className="sticky top-16 z-30 border-b border-border bg-background/80 backdrop-blur-xl dark:border-white/5 dark:bg-black/50">
```

### Section Headers

```tsx
<div className="flex items-center gap-3 mb-6">
  <motion.div
    whileHover={{ scale: 1.1, rotate: -5 }}
    className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"
  >
    <Icon className="w-5 h-5 text-orange-400" />
  </motion.div>
  <h2
    className="text-xl font-semibold text-white"
    style={{ fontFamily: "var(--font-display)" }}
  >
    {title}
  </h2>
</div>
```

---

## Progress Bars

Use warm glow for progress indicators:

```tsx
<div className="h-2 bg-white/5 rounded-full overflow-hidden">
  <motion.div
    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full shadow-[0_0_10px_rgba(255,132,0,0.5)]"
    initial={{ width: 0 }}
    animate={{ width: `${progress}%` }}
    transition={{ duration: 0.5 }}
  />
</div>
```

---

## Chapter/Navigation Dots

```tsx
<button
  className={cn(
    "w-2 h-2 rounded-full transition-all",
    isActive
      ? "bg-accent w-6 shadow-[0_0_10px_rgba(255,132,0,0.5)]"
      : "bg-white/20 hover:bg-white/30",
  )}
/>
```

---

## Do NOT

- Use hard borders without glass effect in dark mode
- Add animated backgrounds to modals/dialogs
- Use pure white text (use white/90 or #f6f6f4)
- Create "pill" badges above page titles (redundant with nav)
- Over-animate (keep orb opacity low, transitions smooth)
- Make filter bars sticky (causes overlap issues)
