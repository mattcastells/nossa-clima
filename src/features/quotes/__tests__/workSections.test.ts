import { describe, expect, it } from 'vitest';

import { splitWorkSections } from '../workSections';

describe('splitWorkSections', () => {
  it('sin marcadores devuelve un unico bloque sin titulo', () => {
    expect(splitWorkSections('Se hizo el service completo.')).toEqual([
      { title: null, body: 'Se hizo el service completo.' },
    ]);
  });

  it('separa diagnostico, Solucion y Observaciones', () => {
    const text =
      'Se detectaron dos problemas.\n\nSolución:\nSe reemplazaron los terminales.\n\nObservaciones:\nSe recomienda revisar la linea.';
    expect(splitWorkSections(text)).toEqual([
      { title: null, body: 'Se detectaron dos problemas.' },
      { title: 'Solución', body: 'Se reemplazaron los terminales.' },
      { title: 'Observaciones', body: 'Se recomienda revisar la linea.' },
    ]);
  });

  it('acepta el marcador con contenido en la misma linea y sin acento', () => {
    const sections = splitWorkSections('Diagnostico.\nSolucion: se cambio el capacitor.\nObservacion: queda en observacion.');
    expect(sections).toEqual([
      { title: null, body: 'Diagnostico.' },
      { title: 'Solución', body: 'se cambio el capacitor.' },
      { title: 'Observaciones', body: 'queda en observacion.' },
    ]);
  });

  // Los resumenes ya escritos usan "Notas:". Se sigue aceptando como marcador,
  // pero se muestra como "Observaciones" para no chocar con los campos
  // "Notas para el informe" / "Notas para el tecnico" del formulario.
  it('acepta "Notas:" heredado y lo muestra como Observaciones', () => {
    expect(splitWorkSections('Diagnostico.\nNotas:\nRevisar la linea.')).toEqual([
      { title: null, body: 'Diagnostico.' },
      { title: 'Observaciones', body: 'Revisar la linea.' },
    ]);
  });

  it('descarta secciones vacias', () => {
    expect(splitWorkSections('Solución:\n\nObservaciones:\nAlgo.')).toEqual([{ title: 'Observaciones', body: 'Algo.' }]);
  });

  it('no confunde "solucion" en medio de una oracion con un marcador', () => {
    const text = 'La solución aplicada fue provisoria.';
    expect(splitWorkSections(text)).toEqual([{ title: null, body: text }]);
  });
});
