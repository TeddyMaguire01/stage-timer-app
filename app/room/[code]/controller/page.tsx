import Controller from "./Controller";

export default async function ControllerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Controller code={code.toUpperCase()} />;
}
