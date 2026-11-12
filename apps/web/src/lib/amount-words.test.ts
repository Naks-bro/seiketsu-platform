import { describe, expect, it } from "vitest";
import { numberToWords, rupeesInWords } from "./amount-words";

describe("amount in words", () => {
  it("writes Indian numbers", () => {
    expect(numberToWords(0)).toBe("Zero");
    expect(numberToWords(15)).toBe("Fifteen");
    expect(numberToWords(250)).toBe("Two Hundred Fifty");
    expect(numberToWords(1250)).toBe("One Thousand Two Hundred Fifty");
    expect(numberToWords(105000)).toBe("One Lakh Five Thousand");
    expect(numberToWords(12345678)).toBe("One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight");
  });

  it("writes rupees and paise", () => {
    expect(rupeesInWords(35000)).toBe("Rupees Three Hundred Fifty Only");
    expect(rupeesInWords(125050)).toBe("Rupees One Thousand Two Hundred Fifty and Fifty Paise Only");
  });
});
