"use client"

import * as React from "react"

const CONSULTA = "(min-width: 768px)"

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener("change", avisar)
  return () => mq.removeEventListener("change", avisar)
}

export function useEsEscritorio() {
  return React.useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => true
  )
}
