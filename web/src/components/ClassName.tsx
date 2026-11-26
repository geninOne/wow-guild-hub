import { classColor } from "../lib/wow";

interface ClassNameProps {
  classId: number;
  name: string;
}

export function ClassName({ classId, name }: ClassNameProps) {
  return <span style={{ color: classColor(classId) }}>{name}</span>;
}
