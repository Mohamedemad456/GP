import * as React from "react"

import { toast as sonnerToast, type ExternalToast } from "sonner"

type ToastMessage = Parameters<typeof sonnerToast>[0]
type ToastData = Parameters<typeof sonnerToast>[1]

function useToast() {
  return React.useMemo(
    () => ({
      toast: (message: ToastMessage, data?: ToastData) => sonnerToast(message, data),
      dismiss: sonnerToast.dismiss,
      success: sonnerToast.success,
      error: sonnerToast.error,
      info: sonnerToast.info,
      warning: sonnerToast.warning,
      promise: sonnerToast.promise,
      loading: sonnerToast.loading,
      custom: sonnerToast.custom,
    }),
    [],
  )
}

const toast = sonnerToast

export { useToast, toast }
export type { ExternalToast }
