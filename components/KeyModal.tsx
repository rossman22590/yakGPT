import { useState } from "react";
import { Button, Group, Box, Loader, px, PasswordInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useChatStore } from "@/stores/ChatStore";
import { IconX } from "@tabler/icons-react";
import { update } from "@/stores/ChatActions";

export function APIPanel({ closeModal }: { closeModal: () => void }) {
  return (
    <div>
    <p>Welcome to Therapy AI</p>
    <div style={{textAlign: 'left'}}>
      <p>Your personal, customizable companion for mental well-being. Offering on demand emotional support with cognitive techniques and mindfulness. Your privacy is our priority.</p>
    </div>
      <p>TherapyAI@info.com</p>
      <p>(1+)203-446-6149</p>

      <Group position="right" mt="md">
        <Button onClick={closeModal} variant="light">
          Close
        </Button>
      </Group>
    </div>
  );
}

export default function KeyModal({ close }: { close: () => void }) {
  const apiKeyOpenAI = useChatStore((state) => state.apiKey);
  const apiKey11Labs = useChatStore((state) => state.apiKey11Labs);
  const apiKeyAzure = useChatStore((state) => state.apiKeyAzure);
  const apiKeyAzureRegion = useChatStore((state) => state.apiKeyAzureRegion);

  const setApiKeyOpenAI = (key: string) => update({ apiKey: key });
  const setApiKeyAzure = (key: string) => update({ apiKeyAzure: key });
  const setApiKeyAzureRegion = (region: string) => update({ apiKeyAzureRegion: region });
  const setApiKey11Labs = (key: string) => update({ apiKey11Labs: key });

  return (
    <div>
      <Box mx="auto">
        <APIPanel closeModal={close} />
      </Box>
    </div>
  );
}
