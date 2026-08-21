/**
 * 光标可视化覆盖层：以初始化脚本注入每个页面，把模型的鼠标操作
 * 画成可见的光标与点击波纹（Codex 同款观感）。
 *
 * 只读监听真实 DOM 鼠标事件（playwright 的坐标操作会派发真实事件），
 * 不拦截、不改写任何页面行为；元素挂在 documentElement 上并置顶，
 * pointer-events 全程为 none，对页面完全透明。
 */
(() => {
  if (window !== window.top) return
  if (window.__tokensCursorOverlay) return
  window.__tokensCursorOverlay = true

  const NS = 'tokens-cursor-overlay'
  const style = document.createElement('style')
  style.textContent = `
    .${NS}, .${NS}-ripple { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; }
    .${NS} {
      width: 22px; height: 22px; margin: -2px 0 0 -2px;
      opacity: 0; transition: opacity .25s ease, transform .06s linear;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.45));
    }
    .${NS}.visible { opacity: 1; }
    .${NS}-ripple {
      width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
      border: 2.5px solid #71e2c0; opacity: .9;
      animation: ${NS}-pop .45s ease-out forwards;
    }
    @keyframes ${NS}-pop {
      from { transform: scale(.35); opacity: .9; }
      to   { transform: scale(1.25); opacity: 0; }
    }
  `

  const cursor = document.createElement('div')
  cursor.className = NS
  // 经典指针箭头形状，青绿描边呼应产品品牌色。
  cursor.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22">'
    + '<path d="M5 2 L5 19 L9.5 15.5 L12.5 21.5 L15 20.3 L12 14.3 L18 14 Z" '
    + 'fill="#fff" stroke="#0b1c26" stroke-width="1.4" stroke-linejoin="round"/></svg>'

  let mounted = false
  const mount = () => {
    if (mounted || !document.documentElement) return
    document.documentElement.append(style, cursor)
    mounted = true
  }

  let hideTimer
  const move = (x, y) => {
    mount()
    cursor.style.transform = `translate(${x}px, ${y}px)`
    cursor.classList.add('visible')
    // 静止 4 秒后淡出，避免光标残留遮挡阅读。
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => cursor.classList.remove('visible'), 4000)
  }

  const ripple = (x, y) => {
    mount()
    const dot = document.createElement('div')
    dot.className = `${NS}-ripple`
    dot.style.transform = ''
    dot.style.left = `${x}px`
    dot.style.top = `${y}px`
    document.documentElement.append(dot)
    setTimeout(() => dot.remove(), 500)
  }

  window.addEventListener('mousemove', e => move(e.clientX, e.clientY), { capture: true, passive: true })
  window.addEventListener('mousedown', e => { move(e.clientX, e.clientY); ripple(e.clientX, e.clientY) }, { capture: true, passive: true })
})()
