import { Portal, Toaster as ChakraToaster, Toast } from "@chakra-ui/toast";
import { toaster } from "@/lib/toaster";

export function Toaster() {
  return (
    <Portal>
      <ChakraToaster
        toaster={toaster}
        insetInline={{ mdDown: "4" }}
        render={(toast) => (
          <Toast.Root width={{ md: "sm" }} key={toast.id}>
            {/* your custom toast layout */}
            {toast.type === "loading" ? "Loading…" : toast.message}
          </Toast.Root>
        )}
      />
    </Portal>
  );
}
