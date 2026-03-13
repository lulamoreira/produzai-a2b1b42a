import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatTabContent from "@/components/ChatTabContent";

interface SchedulingChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName?: string;
}

const SchedulingChatSheet = ({ open, onOpenChange, storeName }: SchedulingChatSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <SheetTitle className="text-sm">
            Chat {storeName ? `— ${storeName}` : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ChatTabContent />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SchedulingChatSheet;
