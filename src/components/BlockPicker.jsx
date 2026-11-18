import { useEffect, useRef, useState } from 'react'
import './BlockPicker.css'

/**
 * Picker made of rectangular blocks that never changes size, so the page stays still.
 * Closed: one big block, as large as the whole menu, showing the current choice.
 * On hover (or click / keyboard focus) it divides like a cell: the big block fades
 * and the option blocks bud out from the centre into their own places.
 *
 * options:  [{ id, label }]                      — one block each
 * all:      { id, label }                        — tall block in its own column on the left
 * block(option, { selected, current }) → { className, style, children } for a block
 * below:    optional content under the label (e.g. an A/B test switch)
 */
export default function BlockPicker({
  title,
  options,
  all,
  value,
  onChange,
  block,
  columns = 6,
  narrowColumns = 3,
  width = '31rem',
  blockHeight = '2.6rem',
  below,
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const closeTimer = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const show = () => {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const hideSoon = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      setHovered(null)
    }, 250)
  }

  const index = options.findIndex((o) => o.id === value)
  const current = index >= 0 ? options[index] : all

  function onKeyDown(e) {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    setOpen(true)
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const start = index < 0 ? (dir > 0 ? -1 : 0) : index
    onChange(options[(start + dir + options.length) % options.length].id)
  }
  function onBlur(e) {
    if (!wrapRef.current?.contains(e.relatedTarget)) setOpen(false)
  }

  // Layout: a narrow "All" column on the left, then the options in `cols` columns.
  const rows = Math.ceil(options.length / columns)
  const narrowRows = Math.ceil(options.length / narrowColumns)

  // How far (in block sizes) each option sits from the centre of the options area.
  // Closed, every block is pulled to the menu's centre (the CSS adds the shift for the
  // "All" column); open, it moves out to its own cell. Blocks nearer the centre split first.
  const offsets = (i, cols, totalRows) => {
    if (i === options.length) return { cx: 0, cy: 0 } // the "All" column, handled in CSS
    const col = i % cols
    const row = Math.floor(i / cols)
    return { cx: (cols - 1) / 2 - col, cy: (totalRows - 1) / 2 - row }
  }

  const tab = open ? 0 : -1
  const blockFor = (option, i) => {
    const isAll = option === all
    const selected = isAll ? index < 0 : option.id === value
    const b = block(option, { selected, current: false })
    const wide = offsets(i, columns, rows)
    const narrow = offsets(i, narrowColumns, narrowRows)
    return (
      <button
        key={String(option.id)}
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={option.label}
        tabIndex={tab}
        className={['bp-block', b.className, isAll && 'all-col', selected && 'selected'].filter(Boolean).join(' ')}
        style={{
          ...b.style,
          '--cx': wide.cx,
          '--cy': wide.cy,
          '--cx-n': narrow.cx,
          '--cy-n': narrow.cy,
          '--d': Math.abs(wide.cx) + Math.abs(wide.cy),
        }}
        onClick={() => onChange(option.id)}
        onMouseEnter={() => setHovered(option.label)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(option.label)}
      >
        {b.children}
      </button>
    )
  }

  const currentBlock = block(current, { selected: true, current: true })

  return (
    <div className="bp-wrap">
    <div
      ref={wrapRef}
      className={open ? 'bp open' : 'bp'}
      style={{
        '--w': `min(${width}, calc(100vw - 3rem))`,
        '--cols': columns,
        '--cols-narrow': narrowColumns,
        '--rows': rows,
        '--rows-narrow': narrowRows,
        '--block-h': blockHeight,
      }}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <div className="bp-box">
        <div className="bp-grid" role="radiogroup" aria-label={title} aria-hidden={!open}>
          {blockFor(all, options.length)}
          {options.map((o, i) => blockFor(o, i))}
        </div>

        {/* The whole menu as one big block, showing the current choice. Divides on hover. */}
        <button
          type="button"
          className={['bp-block bp-current', currentBlock.className].filter(Boolean).join(' ')}
          style={currentBlock.style}
          aria-expanded={open}
          aria-label={`${title}: ${current.label}`}
          tabIndex={open ? -1 : 0}
          onClick={() => setOpen((o) => !o)}
          onFocus={show}
        >
          {currentBlock.children}
        </button>
      </div>

      <p className="bp-caption">
        <span className="bp-title">{title}</span>
        {/* While open, only name what's being pointed at (not the previous choice). */}
        {open ? hovered ?? ' ' : current.label}
      </p>
    </div>
      {/* Outside the hover area, so pointing at it doesn't open the menu. */}
      {below}
    </div>
  )
}
