# Monopop

Gerenciador de estoque e lista de compras para Android. Offline-first, sem backend, sem conta — todos os dados vivem no SQLite do dispositivo.

Desenvolvido para uso real e diário: a usuária primária usa o app no trabalho para controlar inventário e fazer compras corredor por corredor no mercado. Não é um projeto demo — tem dados reais em produção, feedback loop real e bugs com consequências reais.

[⬇️ Download APK](https://github.com/mahjard/monopop/releases/latest)

---

## Funcionalidades

- **Múltiplas listas independentes** — mesmos produtos, estoques separados por lista (trabalho, casa, etc.)
- **Lista de compras com rastreamento de preços** — preço sugerido automaticamente por loja, com fallback para qualquer loja
- **Menor preço em 90 dias** — por produto, carregado em background para não bloquear a interação
- **Importação via texto** — cola uma lista de qualquer fonte; matching fuzzy mapeia para produtos existentes
- **Invoices de compra** — ao concluir, registra nota com data, loja e preços pagos; histórico sem esforço extra
- **Análise de gastos** — tendência vs período anterior, filtrável por data e loja
- **Histórico de quantidades** — rastreia variação de estoque ao longo do tempo; calcula consumo médio/semana
- **Reordenação por drag-and-drop** — ordem customizada do inventário, persistida no banco
- **Categorias colapsáveis na lista de compras** — organização por corredor de mercado
- **Backup e restauração** — exporta tudo como JSON; usuário não fica refém do app
- **100% offline** — sem conta, sem internet, sem latência de rede

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React Native (Expo SDK 54, bare workflow) |
| UI | React Native Paper (Material Design 3) |
| Banco de dados | expo-sqlite (SQLite, schema V8, WAL mode) |
| Navegação | React Navigation (Stack + Bottom Tabs) |
| Animações | Reanimated v4 |
| Runtime | New Architecture (JSI) habilitada |

---

## Arquitetura

### Schema relacional

`Product` (entidade genérica) é separado de `InventoryItem` (instância em uma lista) e de `ShoppingListItem` (intenção de compra). Um produto existe independente de listas; o inventário é sempre scoped a uma lista. Isso permite que o mesmo produto apareça em múltiplas listas com quantidades independentes sem duplicar dados.

`Invoice` + `InvoiceItem` emergem naturalmente do fluxo de conclusão de compras — o histórico de preços por produto por loja surge sem nenhum esforço extra do usuário. Dados acionáveis como consequência natural do uso.

### Gerenciamento de estado

Dois contextos propositalmente separados: `ListContext` guarda apenas `listId` + `setListId` (seleção de navegação); `ListDataContext` guarda os dados dependentes do `listId`. Telas que só precisam do `listId` não carregam o overhead dos dados.

`BottomTabNavigator` recebe `key={listId}` — quando `listId` muda, o navigator remonta inteiro. Efeito colateral intencional: estado local de todas as tabs é limpo ao trocar de lista sem lógica explícita de reset.

`ShoppingListScreen` usa `FlatList` com array flat de rows tipadas (`section-header | category-header | item`) em vez de `SectionList`. Necessário para dois níveis de agrupamento (pendentes/carrinho + sub-headers de categoria colapsáveis) — `SectionList` suporta apenas um nível nativamente.

### Carregamento em duas fases

Dados principais chegam em uma única query com JOIN. Preços históricos (`getLowestPriceForProducts` — JOIN em `invoice_items → invoices → stores`) são carregados em background via `.then()`. A separação é intencional: preços históricos são informativos, não bloqueantes. A lista é interagível imediatamente.

### Encapsulamento de renderização

`InventoryList` detecta `sortOrder === 'category'` internamente e alterna entre `DraggableFlatList` e `SectionList` sem expor isso ao `HomeScreen`. Drag-and-drop entre categorias mudaria o `categoryId` do produto — poderoso mas arriscado de deixar implícito. Comportamento claro: drag desabilitado quando sort é por categoria.

### Reuso de lógica de importação

`useImportEngine` expõe callbacks injetáveis (`applyMatch`, `applyNew`) em vez de comportamento fixo. O mesmo modal de importação é reutilizado tanto para inventário quanto para lista de compras com comportamentos completamente diferentes — zero duplicação de componente.

---

## Decisões técnicas notáveis

**New Architecture (JSI)** — o projeto vinha de uma migração de SDK e nunca tinha habilitado a New Architecture. Com JSI, chamadas SQLite param de serializar/deserializar pela bridge JSON. Cold start: ~3s → ~1s. Cerca de 90% do ganho total de performance veio dessa mudança isolada.

**WAL mode + PRAGMAs** — `synchronous = NORMAL`, `temp_store = memory`, `cache_size = -8000` configurados explicitamente. WAL elimina lock overhead entre leituras e escritas concorrentes; repeat-visit load time caiu de ~900ms para ~33ms.*

**Índices via migration** — após profiling, índices adicionados em `invoices`, `invoice_items` e `inventory_history` na migration V8. `getLowestPriceForProducts` caiu de 1287ms para 5ms.*

**Batch queries** — padrão N+1 eliminado. `getLowestPriceForProducts(ids[])`, `getLastUnitPricesForProductsAtStore`, `getLastUnitPricesForProducts` retornam `Map<productId, value>` para lookup O(1). O código original fazia uma query por item em loop.

**`useInventoryItem` otimista** — salva quantidade na DB imediatamente para garantir responsividade do +/− na HomeScreen. `EditInventoryItemScreen` lida com isso guardando `initialQuantityRef` para reverter no discard, em vez de tentar batchear o save — que quebraria o comportamento da HomeScreen.

**`manualPrices` ref** — durante a sessão de compras, preços editados manualmente ficam protegidos num `useRef<Map>`. Trocar de loja não sobrescreve o que o usuário digitou. Sem essa proteção, a UX seria inaceitável para quem alterna lojas no meio da compra.

**`SearchablePickerDialog` com prop `embedded`** — Modal aninhado dentro de Modal tem comportamento problemático no Android. Modo `embedded` renderiza apenas input + lista sem Portal/Modal próprio, usando `ScrollView` + `map` em vez de `FlatList` (que colapsa sem altura explícita dentro de outro Modal).

**`ConfirmationModal` extraído para arquivo separado** — quando definido dentro do componente pai, React recriava o componente a cada re-render do pai, causando reset de estado no meio do fluxo de importação. Problema silencioso: o modal fechava visualmente mas o estado interno era perdido.

**`MaterialCommunityIcons` em vez de `Checkbox` do Paper** — o componente nativo do Paper tem `overflow: hidden` forçado no Android, causando clipping inconsistente do ícone de check. Ícone direto contorna o pipeline de renderização do Paper e resolve o problema.

**Dirty tracking com `loadingRef` / `mountedRef`** — `loadAll` é assíncrono; sem `loadingRef`, os `setState` internos disparavam o `useEffect` de dirty tracking antes do load terminar, marcando a tela como modificada ao abrir. `mountedRef` resolve o mesmo problema para o primeiro render: sem ele, o `useEffect` com deps de estado roda no mount com valores iniciais e marca `isDirty = true` imediatamente.

**Timezone fix** — datas `YYYY-MM-DD` do SQLite são interpretadas como UTC meia-noite pelo JS. Em UTC-3, viram o dia anterior. Fix: append `T00:00:00` antes de `parseISO` do date-fns para forçar interpretação local.

**`PRAGMA foreign_keys` fora de transaction** — expo-sqlite não permite executar esse pragma dentro de `withTransactionAsync`. Solução: executa fora da transaction, com re-enable no `finally` para garantir execução mesmo em erro.

**Sistema de migrations versionadas** — `PRAGMA user_version` rastreia o schema atual. Cada migration roda uma vez. Permite evolução segura em dispositivos com dados existentes. V1 → V8 em produção.

*_Números de sessão anterior — não verificados contra baseline atual._

---

## Product thinking

**`defaultStoreMode` (ask / last / fixed)** — em vez de sempre perguntar qual loja ou sempre assumir a última, o usuário configura o comportamento que faz sentido pro seu fluxo. Quem sempre compra no mesmo lugar usa `fixed`; quem varia usa `ask`. Esse tipo de decisão distingue feature que funciona de feature que se adapta.

**Pre-fill de preço com fallback em cascata** — ao selecionar loja, o app tenta preencher com o último valor pago naquela loja; se não existe, cai para o último preço em qualquer loja. O usuário raramente precisa digitar preço do zero.

**`isFirstLoad` ref na ShoppingListScreen** — sem esse ref, `useFocusEffect` resetava a loja selecionada toda vez que a usuária voltava de outra aba. Pequeno detalhe com impacto real: a sessão de compras inteira é organizada em torno da loja selecionada.

**`handleAcceptAllSuggestions`** — importação gera sugestões de matching por produto. "Aceitar tudo" aplica best-match silenciosamente. Veio de feedback real: confirmar 30 itens individualmente era intolerável na prática.

**Categorias colapsáveis durante compra** — o caso de uso é genuíno: usuária percorre corredores e colapsa categorias conforme termina cada um, inclusive itens que ficaram pendentes por preço. Features que vêm de comportamento observado tendem a ser mais corretas que as que vêm de especulação.

**Date picker no `ConfirmInvoiceModal` com default hoje** — conclusão retroativa é caso de uso real (compra de ontem registrada hoje). Preview do total visível antes de confirmar — o usuário não deveria confirmar uma nota sem ver o valor sendo registrado.

**Stats derivadas no `EditInventoryItemScreen`** — consumo médio/semana, preço médio 90d e menor preço 90d aparecem sem campo extra, sem esforço do usuário. Dados já existiam nas tabelas; é só computar no momento certo. O usuário pode consultar histórico de preços sem entrar em modo edição.

**Aliases de produto (v1.6)** — o problema que isso resolve é real: "leite integral" e "leite" são o mesmo produto, mas a nomenclatura vem de notas fiscais fora do controle do usuário. Aliases são mais robustos do que forçar padronização manual.

---

## Debugging não-trivial

**Bug silencioso no Hermes release** — `console.time` sem `timeEnd` correspondente, dentro de um bloco `try` sem `finally`, lançava exceção silenciosa no Hermes em modo release. A exceção impedia o `timeEnd` de executar, que por sua vez lançava outra exceção, cortando a função no meio sem logar nada. O mesmo código funcionava no debug. Identificado por eliminação com stepped alerts em build de release.

**`Promise.all` pendente indefinidamente** — durante debug, uma query não resolvia nem rejeitava; o `await Promise.all` ficava pendurado sem entrar no catch. Diagnóstico exigiu substituir por awaits sequenciais com alerts intermediários para isolar qual query estava hangando.

**Cache SQLite como efeito colateral útil** — observação comportamental: aguardar ~3s na HomeScreen antes de navegar fazia a ShoppingListScreen carregar em <1s. A hipótese era "warm-up do SQLite", mas a causa real era que as queries do inventário populavam o page cache com páginas que a ShoppingListScreen também precisava. Diagnóstico por análise de padrão de uso real, sem profiling externo. Isso levou ao `ListDataContext`: compartilhar dados entre telas em vez de queries duplicadas para as mesmas tabelas.

**Bug silencioso em `saveInventoryHistorySnapshot`** — dois bugs coexistentes: (1) INSERT ignorava `quantityToSave` e sempre usava `currentInventoryItem.quantity`; (2) SELECT de date matching usava `=` em vez de `LIKE`, falhando silenciosamente com formatos mistos no DB vindos de versões anteriores. Resultado: dados históricos corrompidos em produção sem erro visível.

---

## Contexto de desenvolvimento

Desenvolvido com agente de código (Cursor/Windsurf) com fluxo estruturado: prompt → código → confirmação → revisão explícita do diff → commit → próxima issue. A revisão explícita antes do commit é parte do processo — não confiança cega no agente.

**Package name e rename** — o app se chamava ListaÍ. Durante o desenvolvimento, um competidor já havia registrado `com.listai.app` na Play Store. O rename para Monopop foi uma decisão de produto com consequência técnica direta: package name `com.mahjard.listai` é mantido por ora para não invalidar instalações existentes, mas será migrado antes da publicação formal.

Dois APKs coexistem no dispositivo da usuária: `com.mahjard.listai` (release, uso diário) e `com.mahjard.listai.dev` (debug, desenvolvimento). O sufixo `.dev` via `applicationIdSuffix` foi uma decisão deliberada para não sobrescrever o app em produção durante o desenvolvimento — padrão comum em times mobile profissionais.

---

## Estrutura

```
src/
├── screens/       # HomeScreen, ShoppingListScreen, HistoryScreen, EditInventoryItemScreen, ...
├── components/    # ImportModal, ConfirmInvoiceModal, ShoppingListItemCard, DateRangePickerModal, ...
├── hooks/         # useImportEngine, useInventory, useListData
├── context/       # ListContext, ListDataContext
├── database/      # database.ts — todas as queries SQLite
└── utils/         # importParsers, similarityUtils, sortUtils, stringUtils
```

---

## Build local (Android)

```bash
cd android
./gradlew assembleRelease
```

APK em `android/app/build/outputs/apk/release/`. Requer JDK 17+ e Android SDK. `gradlew clean` necessário após mudanças nativas; builds subsequentes são rápidos pelo cache do Gradle.

---

## Roadmap

- [ ] Aliases de produto — mapear nomes equivalentes para evitar prompts repetidos no import
- [ ] Sincronização entre dispositivos (feature paga planejada)
- [ ] Widget Android para adição rápida sem abrir o app

---

Desenvolvido por [Mah Jardim](https://github.com/mahjard)