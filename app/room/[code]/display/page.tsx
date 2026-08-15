import Display from "./Display";

export default async function DisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Display code={code.toUpperCase()} />;
}
