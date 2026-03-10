import { parse } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportProduct = { originalName: string; quantity: number };

// ─── Parsers ──────────────────────────────────────────────────────────────────

export const parseImportDate = (lines: string[]): Date | null => {
  const dateFormats = ["dd/MM/yyyy", "dd/MM/yy", "dd/MM", "d/M"];
  const dateRegexes = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})\/(\d{2})\/(\d{2})/,
    /(\d{2})\/(\d{2})/,
    /(\d{1,2})\/(\d{1,2})/,
  ];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  for (const line of lines) {
    for (let i = 0; i < dateFormats.length; i++) {
      const match = line.match(dateRegexes[i]);
      if (match) {
        try {
          const paddedLine =
            i === 3
              ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`
              : line;

          const format = i === 3 ? "dd/MM" : dateFormats[i];
          const parsedDate = parse(paddedLine, format, new Date());

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            if (i === 2 || i === 3) {
              const day = parseInt(match[1], 10);
              const month = parseInt(match[2], 10) - 1;
              let assumedYear = currentYear;
              const parsedMonth = month + 1;
              if (
                parsedMonth > currentMonth ||
                (parsedMonth === currentMonth && day > currentDate.getDate())
              ) {
                assumedYear--;
              }
              return new Date(assumedYear, month, day, 20, 0, 0);
            }
            parsedDate.setHours(20, 0, 0, 0);
            return parsedDate;
          }
        } catch (error) {
          console.error("Error parsing date:", error);
        }
      }
    }
  }
  return null;
};

export const parseImportProducts = (
  lines: string[]
): ImportProduct[] => {
  return lines
    .filter((line) => line.trim())
    .filter((line) => {
      const trimmed = line.trim();
      if (/^[\[✖✨*]/.test(trimmed)) return false;
      if (/\d{1,2}\/\d{1,2}(\/\d{2,4})?/.test(trimmed)) return false;
      if (/\d/.test(trimmed) && trimmed.length > 60) return false;
      if (!/\d/.test(trimmed) && trimmed.length > 36) return false;
      return true;
    })
    .map((line) => {
      let processedLine = line.trim();

      // Remove price-like patterns
      processedLine = processedLine
        .replace(/\b\d+\s*(gramas?|grama|kgs?|kg|ml|litros?|litro|gr|g|l)\b/gi, "")
        .replace(/\b\d+[.,]\d{1,2}\b/g, "")
        .replace(/R\$\s*\d+(\.\d+)?([.,]\d{1,2})?/g, "")
        .replace(/-\s*\d+(\.\d+)?([.,]\d{1,2})?/g, "")
        .replace(/-\s*\d+[.,]\d{1,2}/g, "");

      let quantity = 0;
      let productName = processedLine;

      const parenthesesMatch = processedLine.match(/\((\d+)\)/);
      if (parenthesesMatch) {
        quantity = parseInt(parenthesesMatch[1], 10);
        productName = processedLine.replace(/\(\d+\)/, "");
      } else {
        const colonMatch = processedLine.match(/:\s*(\d+)/);
        if (colonMatch) {
          quantity = parseInt(colonMatch[1], 10);
          productName = processedLine.replace(/:\s*\d+/, "");
        } else {
          const allNumbers = processedLine.match(/(?<!\d)(\d+)(?!\d)/g);
          if (allNumbers && allNumbers.length > 0) {
            const lastNumber = allNumbers[allNumbers.length - 1];
            const lastNumberIndex = processedLine.lastIndexOf(lastNumber);
            const precedingChar = processedLine[lastNumberIndex - 1];
            if (
              lastNumberIndex === processedLine.length - lastNumber.length ||
              precedingChar === " " ||
              precedingChar === ":" ||
              precedingChar === "-" ||
              precedingChar === undefined
            ) {
              const followingChars = processedLine
                .substring(lastNumberIndex + lastNumber.length)
                .toLowerCase();
              if (!followingChars.match(/^(g|ml|l|kg|gr)/)) {
                quantity = parseInt(lastNumber, 10);
                productName =
                  processedLine.substring(0, lastNumberIndex) +
                  processedLine.substring(lastNumberIndex + lastNumber.length);
              }
            }
          }
        }
      }

      productName = productName
        .replace(/\b(reais|real|centavos?)\b/gi, "")
        .replace(/\d+/g, "")
        .replace(/[-\/:_,;]/g, " ")
        .replace(
          /[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FAFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu,
          ""
        )
        .replace(/\s+/g, " ")
        .trim();

      if (!productName) return null;

      return { originalName: productName, quantity };
    })
    .filter((item): item is ImportProduct => item !== null);
};
