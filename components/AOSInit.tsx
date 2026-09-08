'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function AOSInit() {
  const pathname = usePathname()

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      document.querySelectorAll('[data-aos]').forEach(el => el.classList.add('aos-animate'))
      return
    }

    const observedElements = new WeakSet<Element>()

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('aos-animate')
            const once = entry.target.getAttribute('data-aos-once') !== 'false'
            if (once) {
              observer.unobserve(entry.target)
            }
          } else {
            const once = entry.target.getAttribute('data-aos-once') !== 'false'
            if (!once) {
              entry.target.classList.remove('aos-animate')
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.05,
      }
    )

    const attachAOS = () => {
      const elements = document.querySelectorAll<HTMLElement>('[data-aos]')
      elements.forEach(el => {
        if (observedElements.has(el)) return
        observedElements.add(el)
        observer.observe(el)
      })
    }

    attachAOS()

    // Debounced MutationObserver using requestAnimationFrame to batch DOM mutations
    // and eliminate forced synchronous layout thrashing
    let rafId: number | null = null
    const mutationObserver = new MutationObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        attachAOS()
        rafId = null
      })
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [pathname])

  return null
}
