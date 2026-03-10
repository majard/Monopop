# Monopop

Gerenciador de estoque e lista de compras para Android. Offline-first, sem servidores, sem nuvem — tudo vive no SQLite do dispositivo.

Desenvolvido para uso real e diário: a usuária primária usa o app no trabalho para controlar inventário e fazer compras corredor por corredor no mercado.

[⬇️ Download APK](https://github.com/mahjard/monopop/releases/latest)

---

## Funcionalidades

- **Múltiplas listas** — cada lista tem seu próprio inventário e histórico
- **Lista de compras** — itens com preços, organizados por categoria colapsável
- **Rastreamento de preços** — menor preço dos últimos 90 dias por produto; último preço pago por loja
- **Importação via texto** — cola uma lista de qualquer fonte; o app faz matching fuzzy com produtos existentes
- **Invoices de compra** — ao concluir, registra nota com data, loja e preços pagos
- **Histórico de gastos** — tendência de gastos vs período anterior, filtrável por data
- **Histórico de estoque** — rastreia variação de quantidade ao longo do tempo
- **Backup/restauração** — exporta tudo como JSON
- **100% offline** — sem conta, sem servidor, sem internet

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

O app usa uma arquitetura de contexto por lista (`ListDataContext`) como alternativa deliberada a Redux/Zustand: o estado global é sempre scoped a uma lista ativa, nunca app-wide. Isso elimina a necessidade de seletores e evita re-renders cruzados entre listas.

`ShoppingListScreen` usa um `FlatList` com array flat de rows tipadas (`section-header | category-header | item`) em vez de `SectionList` — necessário para suportar dois níveis de agrupamento (pending/cart + categoria) com headers colapsáveis, que `SectionList` não suporta nativamente.

O carregamento de dados na lista de compras é dividido em duas fases: dados principais em uma única query com JOIN, e preços históricos (`getLowestPriceForProducts`) carregados de forma lazy em background — separação intencional porque preços históricos são informativos, não bloqueantes.

---

## Decisões técnicas notáveis

**Offline-first com SQLite** — escolha deliberada por privacidade e zero infra. O trade-off de sincronização entre dispositivos é real e está planejado como feature paga futura.

**New Architecture (JSI)** — habilitada manualmente após migração de SDK legado. O ganho de cold start foi de ~3s para ~1s, principalmente pela eliminação da serialização JSON pela bridge.

**WAL mode + PRAGMAs** — `synchronous = NORMAL`, `temp_store = memory`, `cache_size = -8000` configurados explicitamente para reduzir I/O em dispositivos de entrada.

**Matching fuzzy no import** — `similarityUtils` com Jaro-Winkler + containment bonus para matchear nomes de produtos de diferentes fornecedores. O threshold e os pesos são configuráveis por contexto (import de inventário vs import de lista de compras têm comportamentos diferentes).

---

## Estrutura
```
src/
├── screens/          # HomeScreen, ShoppingListScreen, HistoryScreen, ...
├── components/       # ImportModal, ConfirmInvoiceModal, ShoppingListItemCard, ...
├── hooks/            # useImportEngine, useInventory, useListData
├── context/          # ListContext, ListDataContext
├── database/         # database.ts — todas as queries SQLite
└── utils/            # importParsers, similarityUtils, sortUtils, stringUtils
```

---

## Build local (Android)
```bash
cd android
./gradlew assembleRelease
```

APK gerado em `android/app/build/outputs/apk/release/`.

> Requer JDK 17+ e Android SDK. `gradlew clean` necessário após mudanças nativas.

---

## Roadmap

- [ ] Aliases de produto — mapear nomes equivalentes para evitar prompts repetidos no import
- [ ] Sincronização entre dispositivos (feature paga)
- [ ] Widget Android para adição rápida

---

Desenvolvido por [Mah Jardim](https://github.com/mahjard)