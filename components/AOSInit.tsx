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

        const rect = el.getBoundingClientRect()
        // If element is already in viewport, trigger smoothly
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          setTimeout(() => el.classList.add('aos-animate'), 30)
        } else {
          observer.observe(el)
        }
      })
    }

    attachAOS()

    // MutationObserver to automatically catch newly rendered elements (e.g. tab switches, new posts)
    const mutationObserver = new MutationObserver(() => {
      attachAOS()
    })

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [pathname])

  return null
}
