import ChatWidget from "@/components/chat/ChatWidget";
import { usePetStore } from "@/store/usePetStore";
import { PetOverlay } from "./PetOverlay";

export function CompanionWidget() {
  const enabled = usePetStore((state) => state.enabled);
  return enabled ? <PetOverlay /> : <ChatWidget />;
}
