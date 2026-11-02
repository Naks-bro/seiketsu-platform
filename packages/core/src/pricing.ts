/**
 * Server-authoritative order pricing. Inputs are DB prices (paise); numbers
 * sent by the browser are never used.
 */
import type { Paise } from "./money.ts";

export type TaxSettings = {
  enabled: boolean;
  /** basis points: 500 = 5% */
  rateBps: number;
  /** true when menu prices already include tax */
  inclusive: boolean;
};

export type PricingSettings = {
  tax: TaxSettings;
  deliveryFeePaise: Paise;
  /** null = never free */
  freeDeliveryAbovePaise: Paise | null;
  minOrderPaise: Paise;
};

export type Fulfilment = "pickup" | "delivery";

export type QuoteLine = {
  unitPricePaise: Paise;
  addOnPricesPaise: Paise[];
  quantity: number;
};

export type Quote = {
  lineTotalsPaise: Paise[];
  subtotalPaise: Paise;
  discountPaise: Paise;
  deliveryFeePaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  belowMinimum: boolean;
};

export function lineTotal(line: QuoteLine): Paise {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new Error("Quantity must be a positive integer");
  }
  const unit = line.unitPricePaise + line.addOnPricesPaise.reduce((a, b) => a + b, 0);
  return unit * line.quantity;
}

export function computeQuote(
  lines: QuoteLine[],
  settings: PricingSettings,
  fulfilment: Fulfilment,
  discountPaise: Paise = 0,
): Quote {
  if (lines.length === 0) throw new Error("Cart is empty");
  const lineTotalsPaise = lines.map(lineTotal);
  const subtotalPaise = lineTotalsPaise.reduce((a, b) => a + b, 0);
  const discount = Math.min(Math.max(0, discountPaise), subtotalPaise);
  const itemsAfterDiscount = subtotalPaise - discount;

  // Tax applies to food after discount. Delivery fee is kept outside tax until
  // the accountant confirms how it should be treated.
  const { tax } = settings;
  let taxPaise = 0;
  if (tax.enabled && tax.rateBps > 0) {
    taxPaise = tax.inclusive
      ? itemsAfterDiscount - Math.round((itemsAfterDiscount * 10000) / (10000 + tax.rateBps))
      : Math.round((itemsAfterDiscount * tax.rateBps) / 10000);
  }

  const freeDelivery =
    settings.freeDeliveryAbovePaise !== null && subtotalPaise >= settings.freeDeliveryAbovePaise;
  const deliveryFeePaise = fulfilment === "delivery" && !freeDelivery ? settings.deliveryFeePaise : 0;

  const totalPaise =
    itemsAfterDiscount + deliveryFeePaise + (tax.enabled && !tax.inclusive ? taxPaise : 0);

  return {
    lineTotalsPaise,
    subtotalPaise,
    discountPaise: discount,
    deliveryFeePaise,
    taxPaise,
    totalPaise,
    belowMinimum: subtotalPaise < settings.minOrderPaise,
  };
}
