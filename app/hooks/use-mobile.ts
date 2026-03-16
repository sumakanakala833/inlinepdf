import * as React from "react"

const MOBILE_BREAKPOINT = 768

function getIsMobile() {
  if (typeof window === "undefined") {
    return false
  }

  return window.matchMedia(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`).matches
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(getIsMobile)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`
    )

    const onChange = () => {
      setIsMobile(mediaQuery.matches)
    }

    mediaQuery.addEventListener("change", onChange)
    onChange()

    return () => {
      mediaQuery.removeEventListener("change", onChange)
    }
  }, [])

  return isMobile
}
