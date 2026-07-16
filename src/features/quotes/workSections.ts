export interface WorkSection {
  title: string | null;
  body: string;
}

/**
 * Divide el relato de "Trabajo realizado" en subsecciones. El técnico escribe
 * "Solución:" y "Notas:" dentro del texto (como en los informes que ya arma a
 * mano) y el PDF las levanta como títulos; lo anterior al primer marcador es
 * el diagnóstico. Sin marcadores, todo va como un único bloque.
 */
export const splitWorkSections = (text: string): WorkSection[] => {
  const sections: WorkSection[] = [];
  let current: WorkSection = { title: null, body: '' };

  const pushCurrent = () => {
    const body = current.body.trim();
    if (body || current.title) sections.push({ title: current.title, body });
  };

  text.split('\n').forEach((line) => {
    const marker = /^\s*(soluci[oó]n|notas?)\s*:\s*(.*)$/i.exec(line);
    if (marker) {
      pushCurrent();
      const rawTitle = (marker[1] ?? '').toLowerCase();
      current = { title: rawTitle.startsWith('s') ? 'Solución' : 'Notas', body: marker[2] ?? '' };
      return;
    }
    current.body = current.body ? `${current.body}\n${line}` : line;
  });
  pushCurrent();

  return sections.filter((section) => section.body.trim().length > 0);
};
