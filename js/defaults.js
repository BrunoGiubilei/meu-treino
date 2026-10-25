/* =========================================================
   Meu Treino — Treinos de fábrica (só valem na primeira abertura, para quem ainda não tem dados).
   ========================================================= */

/* =========================================================
   2. Treinos padrão
   Para mudar a lista de fábrica, edite aqui.
   ATENÇÃO: isto só vale para quem ainda não tem dados salvos.
   Quem já usa o app edita a lista pela tela "Editar lista".

   Campos de cada exercício:
     name         nome
     sets         número de séries
     reps         faixa de repetições (ex.: '8-12') ou de segundos
     howTo        como executar
     tip          dica de postura/segurança
     alternatives exercícios que podem substituir este
     unit         opcional: 's' para exercícios medidos em segundos
   ========================================================= */
export const DEFAULT_WORKOUTS = {
  A: {
    title: 'Pernas e core',
    exercises: [
      {
        name: 'Leg press 45°',
        sets: 3,
        reps: '8-12',
        howTo: 'Sente com costas e quadril bem apoiados, pés na largura dos ombros. Desça controlando até cerca de 90° nos joelhos e empurre sem travar no topo.',
        tip: 'Não deixe o quadril descolar do banco nem os joelhos caírem para dentro.',
        alternatives: [
          { name: 'Agachamento goblet', howTo: 'Halter junto ao peito, desça com o tronco ereto e suba empurrando o chão.' },
          { name: 'Agachamento no Smith', howTo: 'Pés um pouco à frente da barra, desça até cerca de 90° e suba controlando.' },
        ],
      },
      {
        name: 'Stiff com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Em pé, halteres à frente das coxas. Leve o quadril para trás com joelhos levemente flexionados e desça até sentir alongar atrás da coxa. Suba contraindo o glúteo.',
        tip: 'Costas retas o tempo todo e halteres rentes às pernas.',
        alternatives: [
          { name: 'Stiff na barra', howTo: 'Mesma execução, com a barra deslizando rente às pernas.' },
          { name: 'Stiff no Smith', howTo: 'Mesma execução, com a barra guiada; bom para aprender o movimento.' },
        ],
      },
      {
        name: 'Cadeira extensora',
        sets: 3,
        reps: '12-15',
        howTo: 'Ajuste o encosto para o joelho alinhar com o eixo da máquina. Estenda as pernas até quase travar e desça em 2 a 3 segundos.',
        tip: 'Sem impulso; faça uma pausa curta no topo.',
        alternatives: [
          { name: 'Afundo com halteres', howTo: 'Passo à frente, desça o joelho de trás quase ao chão e empurre de volta.' },
          { name: 'Step-up no banco', howTo: 'Suba no banco empurrando com a perna da frente, sem impulso da de trás.' },
        ],
      },
      {
        name: 'Mesa flexora',
        sets: 3,
        reps: '12-15',
        howTo: 'Deitado de bruços, joelhos na borda do banco e rolete sobre o calcanhar. Leve o calcanhar ao glúteo e volte devagar.',
        tip: 'Quadril colado ao banco, sem arquear a lombar.',
        alternatives: [
          { name: 'Cadeira flexora', howTo: 'Sentado, prenda as coxas e puxe o rolete para baixo e para trás.' },
          { name: 'Flexora em pé', howTo: 'Em pé na máquina, flexione uma perna por vez sem balançar o corpo.' },
        ],
      },
      {
        name: 'Panturrilha em pé',
        sets: 3,
        reps: '12-15',
        howTo: 'Ombros sob o apoio, pontas dos pés na plataforma. Suba o máximo possível, pause 1 segundo e desça alongando bem.',
        tip: 'Amplitude completa vale mais que carga.',
        alternatives: [
          { name: 'Panturrilha sentado', howTo: 'Joelhos a 90° sob o apoio; suba nas pontas e desça alongando.' },
          { name: 'Panturrilha no leg press', howTo: 'Só as pontas dos pés na plataforma; empurre e volte alongando.' },
        ],
      },
      {
        name: 'Prancha',
        sets: 3,
        reps: '30-45',
        howTo: 'Apoie antebraços e pontas dos pés, corpo em linha reta. Contraia abdômen e glúteos e respire normalmente.',
        tip: 'Quadril nem alto nem caído; pare se a lombar doer.',
        alternatives: [
          { name: 'Prancha lateral', howTo: 'De lado sobre um antebraço, corpo reto; troque de lado na série seguinte.' },
          { name: 'Abdominal na máquina', howTo: 'Contraia o abdômen para flexionar o tronco, sem puxar com os braços.' },
        ],
        unit: 's',
      },
    ],
  },

  B: {
    title: 'Empurrar: peito, ombro e tríceps',
    exercises: [
      {
        name: 'Supino reto com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Deitado, halteres na altura do peito, escápulas juntas e pés firmes. Empurre aproximando os halteres no alto e desça controlando.',
        tip: 'Cotovelos a cerca de 45° do tronco, sem arquear demais a lombar.',
        alternatives: [
          { name: 'Chest press (máquina)', howTo: 'Ajuste o banco para as pegadas ficarem na altura do peito e empurre sem travar os cotovelos.' },
          { name: 'Flexão de braço', howTo: 'Mãos na largura dos ombros, corpo reto; apoie os joelhos se precisar.' },
        ],
      },
      {
        name: 'Supino inclinado com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Banco a 30° a 45°. Empurre os halteres para cima e levemente para dentro, descendo até a linha do peito.',
        tip: 'Não suba demais o banco, senão vira exercício de ombro.',
        alternatives: [
          { name: 'Supino inclinado na máquina', howTo: 'Mesma ideia, com trajetória guiada.' },
          { name: 'Supino inclinado no Smith', howTo: 'Banco inclinado sob a barra; desça até o peito alto e empurre.' },
        ],
      },
      {
        name: 'Desenvolvimento com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Sentado com encosto, halteres na altura das orelhas. Empurre acima da cabeça sem bater os halteres e desça controlando.',
        tip: 'Abdômen firme, sem jogar o tronco para trás.',
        alternatives: [
          { name: 'Desenvolvimento na máquina', howTo: 'Ajuste o banco para as pegadas ficarem na altura dos ombros e empurre.' },
          { name: 'Desenvolvimento no Smith', howTo: 'Sentado sob a barra, empurre até quase estender os cotovelos.' },
        ],
      },
      {
        name: 'Elevação lateral',
        sets: 3,
        reps: '12-15',
        howTo: 'Em pé, halteres ao lado do corpo e cotovelos levemente flexionados. Eleve os braços até a altura dos ombros e desça devagar.',
        tip: 'Carga leve; não balance o tronco.',
        alternatives: [
          { name: 'Elevação lateral na polia', howTo: 'Mesma execução, com tensão constante.' },
          { name: 'Elevação lateral na máquina', howTo: 'Cotovelos nas almofadas, eleve até a altura dos ombros.' },
        ],
      },
      {
        name: 'Tríceps na polia',
        sets: 3,
        reps: '10-15',
        howTo: 'Cotovelos colados ao corpo. Estenda os braços para baixo até quase travar e volte até 90°.',
        tip: 'Só o antebraço se move; ombros relaxados.',
        alternatives: [
          { name: 'Tríceps francês com halter', howTo: 'Halter acima da cabeça, desça atrás da nuca e estenda.' },
          { name: 'Tríceps testa', howTo: 'Deitado, desça os halteres em direção à testa e estenda.' },
        ],
      },
    ],
  },

  C: {
    title: 'Puxar: costas, bíceps e glúteos',
    exercises: [
      {
        name: 'Puxada na frente',
        sets: 3,
        reps: '8-12',
        howTo: 'Pegada um pouco além da largura dos ombros. Puxe a barra até o queixo ou peito alto levando os cotovelos para baixo e volte controlando.',
        tip: 'Peito aberto, sem puxar com impulso do tronco.',
        alternatives: [
          { name: 'Puxada articulada', howTo: 'Mesma ideia, com pegadas guiadas e trajetória fixa.' },
          { name: 'Barra fixa assistida', howTo: 'Use a assistência para repetições completas, queixo acima da barra.' },
        ],
      },
      {
        name: 'Remada sentada',
        sets: 3,
        reps: '8-12',
        howTo: 'Sentado, tronco ereto. Puxe levando os cotovelos para trás, aproximando as escápulas, e volte controlando.',
        tip: 'Sem balançar o tronco; sinta as costas, não os braços.',
        alternatives: [
          { name: 'Remada articulada', howTo: 'Peito apoiado na almofada; puxe os cotovelos para trás.' },
          { name: 'Remada curvada com halteres', howTo: 'Tronco inclinado, costas retas; puxe os halteres em direção ao quadril.' },
        ],
      },
      {
        name: 'Remada unilateral com halter',
        sets: 3,
        reps: '10-12',
        howTo: 'Apoie uma mão e o joelho no banco. Puxe o halter em direção ao quadril e desça alongando as costas.',
        tip: 'Tronco paralelo ao chão, sem girar.',
        alternatives: [
          { name: 'Remada unilateral na polia', howTo: 'Mesma execução, com tensão constante.' },
          { name: 'Remada cavalinho', howTo: 'Peito apoiado, puxe a barra em direção ao abdômen.' },
        ],
      },
      {
        name: 'Elevação pélvica',
        sets: 3,
        reps: '8-12',
        howTo: 'Costas apoiadas no banco, barra ou halter sobre o quadril. Suba contraindo o glúteo até alinhar tronco e coxas e desça controlando.',
        tip: 'Queixo para o peito; não hiperestenda a lombar.',
        alternatives: [
          { name: 'Elevação pélvica no Smith', howTo: 'Mesma execução, com a barra guiada.' },
          { name: 'Coice na polia', howTo: 'Perna estendida para trás contraindo o glúteo, sem arquear a lombar.' },
        ],
      },
      {
        name: 'Rosca direta',
        sets: 3,
        reps: '10-12',
        howTo: 'Em pé, cotovelos junto ao corpo. Flexione os braços até a altura do peito e desça devagar.',
        tip: 'Sem balançar o corpo; cotovelos parados.',
        alternatives: [
          { name: 'Rosca alternada com halteres', howTo: 'Um braço por vez, girando a palma para cima ao subir.' },
          { name: 'Rosca na polia', howTo: 'Mesma execução, com tensão constante.' },
        ],
      },
      {
        name: 'Face pull',
        sets: 3,
        reps: '12-15',
        howTo: 'Polia na altura do rosto com corda. Puxe em direção ao rosto abrindo os cotovelos e feche as escápulas.',
        tip: 'Carga leve; foque na parte de trás dos ombros.',
        alternatives: [
          { name: 'Crucifixo inverso (máquina)', howTo: 'Peito apoiado, abra os braços para trás.' },
          { name: 'Crucifixo inverso com halteres', howTo: 'Tronco inclinado, abra os braços até a altura dos ombros.' },
        ],
      },
    ],
  },
};

/** Converte um exercício padrão (nomes legíveis) para o formato salvo (nomes curtos). */
export function createExercise(letter, index, def) {
  return {
    id: letter + index,
    n: def.name,
    s: def.sets,
    r: def.reps,
    d: def.howTo,
    t: def.tip,
    a: def.alternatives.map(alt => ({ n: alt.name, d: alt.howTo })),
    u: def.unit || 'rep',
  };
}
