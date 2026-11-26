# Catálogo de sinais — Anti-AI UI Review

Adaptado de `avoid-ai-design`, `frontend-slop-guard`, `ui-craft`, `impeccable`, `hallmark`, `superdesign` e `anti-ai-slop-ui`. Severidade considera quem percebe o padrão, não quantas linhas ele ocupa.

| ID | Sev | Sinal | Por que lê como AI | Tratamento no LIVRO-CAIXA |
|---|---|---|---|---|
| T1 | P0 | Paleta purple→blue/indigo, cyan-on-dark sem marca | Cluster mais reconhecível de UI gerada | Nunca usar; tema existente é oliva/verde/lima/terracota/laranja |
| T2 | P0 | Texto com gradiente (`background-clip:text`) | Substitui hierarquia por efeito | Usar peso/tamanho e `--ink`/`--accent` |
| T3 | P1 | Hero centralizado + três cards iguais + CTA | Template padrão de landing | Início é `operate`: hierarquia financeira, cards com papéis distintos |
| T4 | P1 | Inter/Geist/Plus Jakarta como default não decidido | Fonte “segura” converge entre projetos | `--font-family-ui` já é Plus Jakarta Sans; tratar Inter apenas como opção explícita |
| T5 | P1 | Card dentro de card | Lazy container, profundidade sem informação | Flatten: superfície única, dividers e tipografia |
| T6 | P1 | Glassmorphism fora de camada sobreposta | Efeito por reflexo | bottom nav e overlays são justificáveis; cards não |
| T7 | P1 | Colored glow / halo radial / zero-offset accent shadow | “Cool” automático | Sombra neutra com offset; realçar com peso e cor semântica |
| T8 | P1 | Borda colorida de um lado (fingernail) | Quase todo modelo aplica em todo card | Usar `--line`, tone shift ou ícone |
| T9 | P1 | Badge de status sempre verdadeiro/pulsando | Informação que nunca muda | Mostrar apenas estados mutáveis |
| T10 | P1 | Emoji como ícone de interface | Largura/ peso inconsistentes entre plataformas | Conjunto `fi` existente; emoji só como conteúdo do usuário |
| T11 | P1 | Rodapé/título com `·` como separador universal | Separador gerado por hábito | Usar layout/gap; rodapé global é pré-existente e fora de escopo |
| T12 | P1 | Section eyebrow + número decorativo | Chrome de SaaS gerado | Rótulos curtos funcionais são aceitáveis; números decorativos não |
| T13 | P1 | Copy hype: elevate, seamless, next-generation… | Transforma ferramenta em landing | Copy financeira literal: Entradas, Saídas, Resultado, Próximo pagamento |
| T14 | P2 | Mesmo raio+sombra em toda superfície | Achata hierarquia | Reservar variação para destaque real (Patrimônio) |
| T15 | P2 | Todo card sobe no hover | Motion sem significado | Manter hover só em cards/interações reais |
| T16 | P2 | Grid `repeat(3)` por reflexo | Três colunas iguais são default | Verificar se é métrica de dados ou card de conteúdo |
| T17 | P2 | `transition: all`, animar width/height/top/left | Motion amplo e custoso | `transform`/`opacity` e propriedades específicas |
| T18 | P2 | `outline:none` sem substituto `:focus-visible` | Remove acessibilidade | Usar borda/sombra de foco verificável por teclado |
| T19 | P2 | Animação sem `prefers-reduced-motion` | Ignora preferência do usuário | Adicionar fallback quando a animação estiver em escopo |
| T20 | P2 | Muitas cores/tokens em um arquivo (sprawl) | Cada elemento recebe cor própria | Reutilizar tokens semânticos; justificar exceções |

## Exceções legítimas no LIVRO-CAIXA

- `--paper`/`--surface` próximos: fazem parte dos dez temas; diferenciação deve vir de tone shift sutil, borda e sombra.
- `backdrop-filter` na bottom nav: camada realmente sobreposta ao conteúdo.
- Labels uppercase com tracking: linguagem visual já instalada no produto.
- Gradiente suave no Patrimônio Total: decisão aprovada, desde que restrita a um ponto focal.
- Conjunto de três indicadores na Saúde Financeira: métricas reais do mês, não feature cards.
- Rodapé “livro-caixa · dados sincronizados…”: texto pré-existente fora da composição da Início.

## Teste da silhueta

Reduza a captura a 25%, converta em preto e branco e remova detalhes. Se a silhueta virar “hero + três cards” ou qualquer dashboard genérico, há convergência. A aba Início aprovada deve mostrar: bloco de Patrimônio, faixa hierárquica e dois módulos secundários com pesos diferentes.
