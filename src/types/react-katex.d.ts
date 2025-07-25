declare module 'react-katex' {
  import { ComponentType } from 'react'
  
  interface KaTeXProps {
    math: string
    block?: boolean
    errorColor?: string
    renderError?: (error: Error) => React.ReactNode
    settings?: any
  }
  
  export const InlineMath: ComponentType<KaTeXProps>
  export const BlockMath: ComponentType<KaTeXProps>
}