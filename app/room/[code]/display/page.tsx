import Display from "./Display";

export default function DisplayPage({ params }: { params: { code: string } }) {
  return <Display code={params.code.toUpperCase()} />;
}
