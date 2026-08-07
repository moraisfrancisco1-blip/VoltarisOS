# Regras de trabalho para agentes

Este repositório contém trabalho em curso. Preservar todo o código, configuração e conteúdo já existente é mais importante do que fazer uma alteração depressa.

## Limites de alteração

- Fazer apenas alterações mínimas, focadas no pedido actual.
- Antes de editar, identificar os ficheiros que serão afectados e ler o respectivo contexto.
- Não apagar, substituir integralmente, mover, renomear ou reformatar em massa ficheiros existentes sem autorização explícita do utilizador.
- Não remover código aparentemente não usado, comentários, configurações, funcionalidades ou trabalho em curso fora do âmbito do pedido.
- Nunca reverter nem descartar alterações do utilizador. Se existirem modificações não relacionadas no directório de trabalho, preservá-las.
- Não editar ficheiros fora do âmbito da tarefa e não alterar ficheiros gerados, segredos ou ficheiros de ambiente local sem pedido explícito.

## Git e checkpoints

- Antes de uma alteração com impacto, executar `git status --short` e comunicar alterações já existentes que possam ser afectadas.
- Nunca executar comandos destrutivos sem autorização explícita: `git reset --hard`, `git clean -fd`, `git checkout -- <ficheiro>`, `git restore`, `git push --force`, ou equivalentes.
- Trabalhar numa branch de tarefa com o prefixo `codex/`, a menos que o utilizador indique outra.
- Antes de alterações mais amplas, sugerir ou criar (quando solicitado) um commit de checkpoint com o estado actual.
- No fim, apresentar `git diff --stat` e o diff dos ficheiros alterados, e resumir claramente o que mudou e o que não foi alterado.
- Só criar commits, fazer push ou abrir pull requests quando o utilizador o pedir.

## Implementação e validação

- Preferir alterações incrementais em vez de reescrever ficheiros completos.
- Manter APIs, contratos, comportamentos e compatibilidade existentes, excepto se a tarefa pedir explicitamente uma alteração.
- Executar os testes, validações ou verificações mais relevantes para os ficheiros modificados. Se não for possível, indicar o motivo.
- Se o pedido for ambíguo e puder implicar perda de trabalho ou uma decisão arquitectural significativa, parar e pedir orientação.

## Comunicação esperada

- Antes de editar, indicar de forma curta quais os ficheiros e a intenção da alteração.
- Depois de editar, reportar os ficheiros realmente modificados, as validações executadas e quaisquer riscos ou decisões pendentes.
