# Skills para el PRD del proyecto final

Estas dos *skills* son instrucciones para un agente de IA (Claude Code, Codex, Cursor, Copilot, ChatGPT, Gemini…). Le dan al agente el rol de **entrevistador**: en lugar de escribir el proyecto por ustedes, les hace preguntas hasta que el equipo tenga claro qué va a construir y por qué.

La IA se vale y se recomienda. Lo que **no** se vale es entregar algo que el equipo no leyó ni entiende. En la defensa del proyecto le voy a preguntar a cualquiera de ustedes **dónde vive** el gateway, el directorio y el balanceador, cómo manejan las operaciones entre servicios y qué pasa si algo falla. No califico la lógica de negocio: califico la arquitectura y las decisiones.

## Qué es el PRD

El **PRD** (*Product Requirements Document*) es el documento que dice qué va a hacer su sistema, para quién, qué problema resuelve y qué decisiones tomaron. Es la base de todo lo que construyan después.

## Las dos skills

| Skill | Para qué | Cuándo |
|---|---|---|
| `metodo-socratico` | Definir el PRD desde cero, o revisar uno que ya tienen | **Esta semana.** Primero esta |
| `product-manager` | Agregar, quitar o cambiar una funcionalidad del PRD | Más adelante, cuando el proyecto cambie |

Las dos hacen **una pregunta a la vez** y al final escriben `docs/PRD.md`.

## Cómo hacer el PRD esta semana

1. **Júntense los cuatro**, en persona o en llamada, con una sola pantalla compartida. El PRD es del equipo, no de quien tenga la computadora.
2. **Carguen la skill `metodo-socratico`** en su agente (abajo dice cómo).
3. **Arranquen** con algo como: *"Usa la skill metodo-socratico. Queremos definir el PRD de nuestro proyecto final."*
4. **Contesten cada pregunta entre todos.** Si no se ponen de acuerdo, díganselo: lo anota como desacuerdo para que lo resuelvan ustedes.
5. **No le pidan que decida por ustedes.** Les va a regresar la pregunta. Esa es la idea: el PRD tiene que salir de sus cabezas.
6. **Al final escribe `docs/PRD.md`.** Léanlo completo antes de subirlo. Si algo no es lo que dijeron, corríjanlo, o pídanle: *"Revisa nuestro PRD con el método socrático"*.

La sección **"Dónde vive cada pieza"** es la más importante: es lo que les voy a preguntar en la defensa.

Acoten: **tres o cuatro servicios bien hechos** valen más que diez a medias. Empiecen por un monolito sencillo y pártanlo por ramas, como Mexi Banco: `01-monolito`, `02-separacion`, `03-...`.

## Cómo cargar una skill

Cada skill es una carpeta con un archivo `SKILL.md`. Copien **la carpeta completa** al repo de su proyecto:

| Herramienta | Dónde va |
|---|---|
| Claude Code | `.claude/skills/<nombre>/SKILL.md`, en la raíz de su repo |
| Codex | `.agents/skills/<nombre>/SKILL.md` |
| Cursor, Copilot, ChatGPT, Gemini u otra | Abran el `SKILL.md`, copien todo su contenido y péguenlo como primer mensaje, seguido de *"Sigue estas instrucciones"* |

En Claude Code y Codex basta con nombrarla en el mensaje: *"Usa la skill metodo-socratico"*.

## Después del PRD

Cada vez que vean un tema nuevo en clase (gateway, directorio, balanceo, transacciones entre servicios, resiliencia…), pregúntense dónde vive en su proyecto. Si cambia algo de lo que van a construir, actualicen el PRD con `product-manager`.
