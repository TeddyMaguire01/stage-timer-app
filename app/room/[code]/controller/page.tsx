import Controller from "./Controller";

export default function ControllerPage({ params }: { params: { code: string } }) {
  return <Controller code={params.code.toUpperCase()} />;
}
