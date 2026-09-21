import { useCallback, useRef, useState } from 'react'

// Google-Sheets-style column resizing. Give it starting widths (px);
// it returns the live widths plus a <ColResizer/> to drop into each <th>.
// Requires the table to have `table-layout: fixed` (already set on
// .data-table), since with fixed layout the header row's cell widths
// define every column's width — no need to also resize the <td>s.
export function useResizableColumns(initialWidths) {
  const [widths, setWidths] = useState(initialWidths)
  const dragRef = useRef(null)

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return
    const { index, startX, startWidth } = dragRef.current
    const next = Math.max(50, startWidth + (e.clientX - startX))
    setWidths((w) => {
      const copy = [...w]
      copy[index] = next
      return copy
    })
  }, [])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const startResize = useCallback(
    (index) => (e) => {
      dragRef.current = { index, startX: e.clientX, startWidth: widths[index] }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [widths, onMouseMove, onMouseUp]
  )

  return { widths, startResize }
}

export function ColResizer({ onMouseDown }) {
  return <span className="col-resizer" onMouseDown={onMouseDown} onClick={(e) => e.stopPropagation()} />
}
