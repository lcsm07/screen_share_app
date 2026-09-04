import { RoomGate } from "@/components/RoomGate";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage(props: PageProps) {
  const params = await props.params;
  const code = params.code.toUpperCase();
  return <RoomGate code={code} />;
}
