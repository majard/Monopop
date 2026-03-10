import { InventoryItem } from "../database/models";

const PRODUCT_EMOJI_MAP: Array<[string[], string]> = [
  // Vegetables
  [["batata"], "🥔"],
  [["abóbora"], "🎃"],
  [["brócolis", "brocolis"], "🥦"],
  [["cenoura"], "🥕"],
  [["tomate"], "🍅"],
  [["cebola"], "🧅"],
  [["alho"], "🧄"],
  [["alface", "rúcula", "rucula"], "🥬"],
  [["pepino"], "🥒"],
  [["pimentão", "pimentao", "pimenta"], "🌶️"],
  [["milho"], "🌽"],
  [["cogumelo"], "🍄"],
  // Grains & carbs
  [["arroz"], "🍚"],
  [["feijão", "feijao"], "🫘"],
  [["lentilha", "grão", "grao"], "🫘"],
  [["macarrão", "macarrao", "espaguete", "risoto"], "🍝"],
  [["pão", "pao"], "🍞"],
  [["biscoito", "bolacha"], "🍪"],
  [["bolo"], "🎂"],
  [["farinha", "aveia"], "🌾"],
  [["panqueca"], "🥞"],
  [["waffle"], "🧇"],
  // Fruits
  [["banana"], "🍌"],
  [["laranja"], "🍊"],
  [["limão", "limao"], "🍋"],
  [["uva"], "🍇"],
  [["morango"], "🍓"],
  [["melancia"], "🍉"],
  [["melão", "melao"], "🍈"],
  [["manga"], "🥭"],
  [["abacaxi"], "🍍"],
  [["abacate"], "🥑"],
  [["maçã", "maca"], "🍎"],
  [["pêra", "pera"], "🍐"],
  // Proteins
  [["frango", "galinha", "filé de peito", "file de peito"], "🍗"],
  [["carne", "bife", "picadinho", "costela", "alcatra", "maminha"], "🥩"],
  [["peixe", "atum", "salmão", "salmao", "tilápia", "tilapia"], "🐟"],
  [["camarão", "camarao"], "🦐"],
  [["ovo", "ovos"], "🥚"],
  [["bacon", "presunto"], "🥓"],
  [["linguiça", "linguica", "salsicha"], "🌭"],
  // Dairy
  [["azeite", "óleo", "oleo"], "🫙"],
  [["leite"], "🥛"],
  [["queijo"], "🧀"],
  [["manteiga", "margarina"], "🧈"],
  [["iogurte"], "🥛"],
  [["creme de leite", "nata"], "🥛"],
  // Drinks
  [["suco"], "🧃"],
  [["refrigerante", "coca", "pepsi", "guaraná", "guarana"], "🥤"],
  [["cerveja"], "🍺"],
  [["vinho"], "🍷"],
  [["café", "cafe"], "☕"],
  [["chá", "cha"], "🍵"],
  [["achocolatado", "chocolate"], "🍫"],
  [["água", "agua"], "💧"],
  // Condiments & misc
  [["mel"], "🍯"],
  [["sal"], "🧂"],
  [["açúcar", "acucar"], "🍬"],
  [["molho", "ketchup", "mostarda", "maionese"], "🫙"],
  [["sorvete", "gelado"], "🍦"],
  // Cleaning & household
  [["detergente", "sabão", "sabao"], "🧴"],
  [["lava roupa", "lava-roupa", "amaciante"], "🧺"],
  [["papel higiênico", "papel higienico"], "🧻"],
  [["esponja"], "🧽"],
  [["desinfetante", "alvejante"], "🧹"],
  // Personal care
  [["shampoo", "condicionador"], "🧴"],
  [["sabonete"], "🧼"],
  [["pasta de dente", "escova de dente"], "🪥"],
  [["fralda"], "👶"],
];

const LIST_EMOJI_MAP: Array<[string[], string]> = [
  [["mercado", "supermercado"], "🛒"],
  [["frutas", "verduras", "hortifruti"], "🥦"],
  [["padaria"], "🥖"],
  [["café", "cafe"], "☕"],
  [["carne", "açougue", "acougue"], "🥩"],
  [["festa", "evento"], "🎉"],
  [["casa", "doméstico", "domestico"], "🏠"],
  [["trabalho", "escritório", "escritorio"], "💼"],
  [["viagem"], "✈️"],
  [["farmácia", "farmacia", "remédio", "remedio"], "💊"],
  [["pet", "animal", "veterinário", "veterinario"], "🐾"],
  [["limpeza"], "🧹"],
  [["bebê", "bebe", "infantil"], "👶"],
];

export const getEmojiForProduct = (name: string): string => {
  const lower = name.toLowerCase();
  for (const entry of PRODUCT_EMOJI_MAP) {
    const keywords = entry[0];
    const emoji = entry[1];
    if (keywords.some((k: string) => lower.includes(k))) return emoji;
  }
  return "🛒";
};

export const getEmojiForList = (name: string): string => {
  const lower = name.toLowerCase();
  for (const entry of LIST_EMOJI_MAP) {
    const keywords = entry[0];
    const emoji = entry[1];
    if (keywords.some((k: string) => lower.includes(k))) return emoji;
  }
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
    text += inventoryItem.notes ? `  obs:   ${inventoryItem.notes}\n` : "";
  });
  return text;
};

export const generateShoppingListText = (items: { productName: string; quantity: number }[]): string => {
  let text = '';
  items.forEach(item => {
    const emoji = getEmojiForProduct(item.productName);
    text += `- ${item.productName}: ${item.quantity} ${emoji}\n`;
  });
  return text.trim();
};