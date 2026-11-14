// Tabela oficial do simulado: índice = acertos (0..60), valor = nota (0..10).
// Hard-coded de propósito: o arredondamento do ICEV é irregular, não usar fórmula.
export const SIMULADO_TABLE: readonly number[] = [
  0.00, 0.21, 0.42, 0.62, 0.83, 1.04, 1.25, 1.46, 1.67, 1.87,
  2.08, 2.29, 2.50, 2.71, 2.92, 3.12, 3.33, 3.54, 3.75, 3.96,
  4.17, 4.37, 4.58, 4.79, 5.00, 5.21, 5.42, 5.62, 5.83, 6.04,
  6.25, 6.46, 6.67, 6.87, 7.08, 7.29, 7.50, 7.71, 7.92, 8.12,
  8.33, 8.54, 8.75, 8.96, 9.17, 9.37, 9.58, 9.79,
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
];

export function notaFromAcertos(a: number): number {
  return SIMULADO_TABLE[a];
}

// Menor número de acertos cuja nota da tabela é ≥ `nota`.
// Retorna null se `nota` > 10 (impossível) e 0 se `nota` ≤ 0.
export function acertosFor(nota: number): number | null {
  if (nota > 10) return null;
  if (nota <= 0) return 0;
  const idx = SIMULADO_TABLE.findIndex((v) => v >= nota - 1e-9);
  return idx === -1 ? null : idx;
}
