# 🏋️‍♂️ Meu Treino PWA

Uma aplicação web progressiva (PWA) simples, leve e autocontida para acompanhamento de rotinas de treino na academia, focada em funcionamento offline e privacidade de dados.

## 🚀 Funcionalidades

- **Treinos Estruturados:** Rotinas divididas em A, B e C com lista de exercícios, séries e faixas de repetições.
- **Funcionamento Offline:** PWA com *Service Worker* ativado, permitindo acesso completo mesmo sem conexão à internet.
- **Temporizador de Descanso:** Timer integrado de 60s, 90s e 120s com alerta sonoro e vibração.
- **Progressão de Carga:** Identificação automática do topo da faixa de repetições com sugestão de incremento de carga.
- **Privacidade & Backup:** Todos os dados ficam salvos exclusivamente no `localStorage` do dispositivo. Inclui funcionalidade para exportar e importar backups manualmente.
- **Interface Adaptável:** Suporte automático a modo claro e escuro (*Dark Mode*).

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3** (Variáveis CSS, CSS Grid/Flexbox)
- **JavaScript Pure (Vanilla)**
- **Service Worker API**
- **Web App Manifest**

## 📂 Estrutura de Ficheiros

```text
├── index.html        # Estrutura principal da aplicação e lógica do treino
├── manifest.json     # Ficheiro de manifest do PWA (ícone, nome e cores)
├── sw.js             # Service Worker para cache e suporte offline
└── icon-192.png      # Ícone do aplicativo (192x192)