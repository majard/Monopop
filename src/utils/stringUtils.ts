import { InventoryItem } from "../database/models";

export const getEmojiForProduct = (name: string): string => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("batata")) return "🥔";
    if (nameLower.includes("abóbora")) return "🎃";
    if (nameLower.includes("brócolis")) return "🥦";
    if (nameLower.includes("arroz")) return "🍚";
    if (nameLower.includes("risoto")) return "🍝";
    if (nameLower.includes("milho")) return "🌽";
    if (nameLower.includes("picadinho")) return "🍖";
    if (nameLower.includes("tropical")) return "🌴";
    if (nameLower.includes("panqueca")) return "🥞";
    if (nameLower.includes("waffle")) return "🧇";
    if (nameLower.includes("pão")) return "🍞";
    if (nameLower.includes("macarrão")) return "🍝";
    return "🍽️";
  };

export const getEmojiForList = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("mercado") || nameLower.includes("supermercado")) return "🛒";
  if (nameLower.includes("frutas") || nameLower.includes("verduras")) return "🥦";
  if (nameLower.includes("padaria")) return "🥖";
  if (nameLower.includes("café")) return "☕";
  if (nameLower.includes("carnes")) return "🥩";
  if (nameLower.includes("festa")) return "🎉";
  if (nameLower.includes("casa")) return "🏠";
  if (nameLower.includes("trabalho")) return "💼";
  if (nameLower.includes("viagem")) return "✈️";
  if (nameLower.includes("farmácia")) return "💊";
  if (nameLower.includes("pet")) return "🐾";
  return "📝";
};

export const generateStockListText = (inventoryItems: InventoryItem[]): string => {
  const today = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  let text = `Boa noite! ${dateStr}\n\n`;
  text += "Aqui está a lista de produção do dia:\n\n";
  inventoryItems.forEach((inventoryItem) => {
    const emoji = getEmojiForProduct(inventoryItem.productName);
    text += `- ${inventoryItem.productName}: ${inventoryItem.quantity} ${emoji}\n`;
    text += inventoryItem.notes ? `  -   ${inventoryItem.notes}\n` : "";
  });
  return text;
};