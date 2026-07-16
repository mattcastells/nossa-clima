import { describe, expect, it } from 'vitest';

import { splitWorkSections } from '../workSections';

describe('splitWorkSections', () => {
  it('sin marcadores devuelve un unico bloque sin titulo', () => {
    expect(splitWorkSections('Se hizo el service completo.')).toEqual([
      { title: null, body: 'Se hizo el service completo.' },
    ]);
  });

  it('separa diagnostico, Solucion y Notas', () => {
    const text = 'Se detectaron dos problemas.\n\nSolución:\nSe reemplazaron los terminales.\n\nNotas:\nSe recomienda revisar la linea.';
    expect(splitWorkSections(text)).toEqual([
      { title: null, body: 'Se detectaron dos problemas.' },
      { title: 'Solución', body: 'Se reemplazaron los terminales.' },
      { title: 'Notas', body: 'Se recomienda revisar la linea.' },
    ]);
  });

  it('acepta el marcador con contenido en la misma linea y sin acento', () => {
    const sections = splitWorkSections('Diagnostico.\nSolucion: se cambio el capacitor.\nNota: queda en observacion.');
    expect(sections).toEqual([
      { title: null, body: 'Diagnostico.' },
      { title: 'Solución', body: 'se cambio el capacitor.' },
      { title: 'Notas', body: 'queda en observacion.' },
    ]);
  });

  it('descarta secciones vacias', () => {
    expect(splitWorkSections('Solución:\n\nNotas:\nAlgo.')).toEqual([{ title: 'Notas', body: 'Algo.' }]);
  });

  it('no confunde "solucion" en medio de una oracion con un marcador', () => {
    const text = 'La solución aplicada fue provisoria.';
    expect(splitWorkSections(text)).toEqual([{ title: null, body: text }]);
  });
});
