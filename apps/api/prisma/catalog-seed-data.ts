/**
 * Static, hand-curated global catalog data — no external APIs, scraping, AI,
 * or barcodes (see DATABASE.md, "Global product catalog"). Grown by editing
 * `PRODUCT_FAMILIES` below and re-running `npm run db:seed:catalog` (or
 * `db:seed`, which calls the same upsert) — safe to run repeatedly,
 * including in production, since `upsertCatalogProducts`
 * (lib/upsert-catalog-products.ts) upserts on the (brand, name, volume)
 * natural key.
 *
 * Organized as **families** (a product line — e.g. "Kaiak") expanded into
 * individual catalog entries (its variants — e.g. "Clássico", "Aero") so a
 * few hundred real, well-known variants across the six brands this app
 * targets (Natura, Boticário, Avon, Eudora, Jequiti, Hinode) can be
 * authored without repeating brand/category/description boilerplate per
 * entry. `name` always embeds the product type (e.g. "Hidratante Corporal
 * Tododia", "Shampoo Siàge") so two families sharing a fragrance/shade
 * suffix pool never collide on the (brand, name, volume) natural key.
 */
export interface CatalogSeedEntry {
  brand: string;
  name: string;
  category?: string;
  volume?: string;
  description?: string;
}

interface ProductFamilyVariant {
  /** Appended after the family's base name — omit for a single-variant family. */
  suffix?: string;
  volume?: string;
  description?: string;
}

interface ProductFamily {
  brand: string;
  name: string;
  category: string;
  /** Default volume for every variant, unless the variant overrides it. */
  volume?: string;
  /** Default description for every variant, unless the variant overrides it. */
  description?: string;
  variants: ProductFamilyVariant[];
}

function expandFamily(family: ProductFamily): CatalogSeedEntry[] {
  return family.variants.map((variant) => ({
    brand: family.brand,
    name: variant.suffix ? `${family.name} ${variant.suffix}` : family.name,
    category: family.category,
    volume: variant.volume ?? family.volume,
    description: variant.description ?? family.description,
  }));
}

const PERFUMARIA = 'Perfumaria';
const MAQUIAGEM = 'Maquiagem';
const PELE = 'Cuidados com a Pele';
const CABELOS = 'Cuidados com os Cabelos';
const CORPORAL = 'Cuidados Corporais';
const HIGIENE = 'Higiene Pessoal';
const INFANTIL = 'Perfumaria Infantil';
/**
 * Deodorants, body splashes, and "colônia corporal" formats of an existing
 * fragrance — distinct from PERFUMARIA so a category filter can actually
 * separate "Kaiak Clássico" (the perfume) from "Desodorante Aerosol Kaiak
 * Clássico" (the deodorant of the same fragrance), instead of lumping both
 * under the same bucket.
 */
const CORPO_E_BANHO = 'Corpo e Banho';

function suffixed(suffixes: string[]): ProductFamilyVariant[] {
  return suffixes.map((suffix) => ({ suffix }));
}

const PRODUCT_FAMILIES: ProductFamily[] = [
  // ---------------------------------------------------------------------
  // Natura
  // ---------------------------------------------------------------------
  {
    brand: 'Natura',
    name: 'Kaiak',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Perfume masculino refrescante, um dos ícones da Natura.',
    variants: suffixed(['Clássico', 'Aero', 'Pulso', 'Urbe', 'Fusion', 'Oceano']),
  },
  {
    brand: 'Natura',
    name: 'Kaiak Feminino',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Versão feminina da linha Kaiak.',
    variants: suffixed(['Clássico', 'Aero', 'Oceano']),
  },
  {
    brand: 'Natura',
    name: 'Desodorante Aerosol Kaiak',
    category: CORPO_E_BANHO,
    volume: '150ml',
    description: 'Desodorante antitranspirante com a fragrância Kaiak.',
    variants: suffixed(['Clássico', 'Aero', 'Pulso', 'Urbe']),
  },
  {
    brand: 'Natura',
    name: 'Luna',
    category: PERFUMARIA,
    volume: '75ml',
    description: 'Perfume feminino floral amadeirado.',
    variants: suffixed(['Clássico', 'Elixir', 'Poeme', 'Nude', 'Brilhante']),
  },
  {
    brand: 'Natura',
    name: 'Essencial Feminino',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Perfume floral amadeirado, um dos mais vendidos da Natura.',
    variants: suffixed(['Clássico', 'Oud', 'Floral', 'Exclusivo', 'Musk']),
  },
  {
    brand: 'Natura',
    name: 'Essencial Masculino',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Versão masculina amadeirada e especiada da linha Essencial.',
    variants: suffixed(['Clássico', 'Exclusivo', 'Elixir', 'Oud']),
  },
  {
    brand: 'Natura',
    name: 'Body Splash Humor',
    category: CORPO_E_BANHO,
    volume: '200ml',
    description: 'Body splash perfumado para uso diário.',
    variants: suffixed([
      'Doce Encanto',
      'Frescor Cítrico',
      'Floral Suave',
      'Ameixa Selvagem',
      'Baunilha e Coco',
      'Flor de Laranjeira',
      'Jasmim Branco',
      'Frutas Vermelhas',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Água de Cheiro',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Fragrância leve e refrescante para o dia a dia.',
    variants: suffixed([
      'Talco',
      'Baunilha',
      'Flores Brancas',
      'Frutas Vermelhas',
      'Alecrim e Alfazema',
      'Capim-Limão',
      'Erva-Doce',
      'Lavanda',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Desodorante Colônia Água de Cheiro',
    category: CORPO_E_BANHO,
    volume: '200ml',
    description: 'Versão body spray da linha Água de Cheiro.',
    variants: suffixed([
      'Talco',
      'Baunilha',
      'Flores Brancas',
      'Frutas Vermelhas',
      'Alecrim e Alfazema',
      'Capim-Limão',
      'Erva-Doce',
      'Lavanda',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Biografia',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Perfume sofisticado e envolvente.',
    variants: suffixed(['Feminino', 'Masculino']),
  },
  {
    brand: 'Natura',
    name: 'Natura Homem',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Linha de perfumaria masculina do dia a dia.',
    variants: suffixed(['Elements Água', 'Elements Terra', 'Elements Fogo', 'Elements Ar', 'Motion', 'Empower']),
  },
  {
    brand: 'Natura',
    name: 'Desodorante Colônia Natura Homem',
    category: CORPO_E_BANHO,
    volume: '200ml',
    variants: suffixed(['Elements Água', 'Elements Terra', 'Elements Fogo', 'Elements Ar', 'Motion', 'Empower']),
  },
  {
    brand: 'Natura',
    name: 'Chronos',
    category: PELE,
    description: 'Linha de cuidados faciais antissinais.',
    variants: [
      { suffix: 'Creme Antissinais Dia', volume: '50g' },
      { suffix: 'Creme Antissinais Noite', volume: '50g' },
      { suffix: 'Sérum Facial Renovador', volume: '30ml' },
      { suffix: 'Água Micelar', volume: '200ml' },
      { suffix: 'Creme para Área dos Olhos', volume: '15g' },
      { suffix: 'Esfoliante Facial', volume: '100g' },
      { suffix: 'Protetor Solar Facial FPS 50', volume: '50g' },
      { suffix: 'Creme para as Mãos', volume: '75g' },
      { suffix: 'Máscara Facial', volume: '100g' },
    ],
  },
  {
    brand: 'Natura',
    name: 'Hidratante Desodorante Corporal Tododia',
    category: CORPORAL,
    volume: '400ml',
    description: 'Hidratante corporal perfumado de uso diário.',
    variants: suffixed([
      'Buriti',
      'Castanha',
      'Camomila e Aveia',
      'Jasmim',
      'Cereja',
      'Maçã Verde',
      'Ameixa',
      'Macadâmia',
      'Coco',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Sabonete em Barra Tododia',
    category: HIGIENE,
    volume: '90g',
    variants: suffixed([
      'Buriti',
      'Castanha',
      'Camomila e Aveia',
      'Jasmim',
      'Cereja',
      'Maçã Verde',
      'Ameixa',
      'Macadâmia',
      'Coco',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Hidratante Corporal Ekos',
    category: CORPORAL,
    volume: '400ml',
    description: 'Linha de cuidados corporais com ingredientes da biodiversidade brasileira.',
    variants: suffixed([
      'Castanha',
      'Andiroba',
      'Maracujá',
      'Melão-de-São-Caetano',
      'Jatobá',
      'Priprioca',
      'Buriti',
      'Mandacaru',
      'Pitanga',
      'Cupuaçu',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Óleo Corporal Ekos',
    category: CORPORAL,
    volume: '200ml',
    variants: suffixed(['Castanha', 'Andiroba', 'Maracujá', 'Priprioca', 'Buriti', 'Cupuaçu']),
  },
  {
    brand: 'Natura',
    name: 'Sabonete em Barra Ekos',
    category: HIGIENE,
    volume: '100g',
    variants: suffixed(['Castanha', 'Buriti', 'Maracujá', 'Priprioca', 'Cupuaçu', 'Andiroba']),
  },
  {
    brand: 'Natura',
    name: 'Shampoo Ekos',
    category: CABELOS,
    volume: '300ml',
    variants: suffixed(['Castanha', 'Buriti', 'Maracujá', 'Priprioca']),
  },
  {
    brand: 'Natura',
    name: 'Batom Una',
    category: MAQUIAGEM,
    description: 'Linha de maquiagem da Natura.',
    variants: [
      { suffix: 'Matte Nude', volume: '3.5g' },
      { suffix: 'Matte Vermelho', volume: '3.5g' },
      { suffix: 'Matte Rosa', volume: '3.5g' },
      { suffix: 'Cremoso Coral', volume: '3.5g' },
      { suffix: 'Cremoso Marsala', volume: '3.5g' },
    ],
  },
  {
    brand: 'Natura',
    name: 'Una',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Base Líquida Natural', volume: '30ml' },
      { suffix: 'Base Líquida Bege', volume: '30ml' },
      { suffix: 'Pó Compacto Translúcido', volume: '10g' },
      { suffix: 'Blush Compacto Rosa', volume: '5g' },
      { suffix: 'Máscara de Cílios Volume', volume: '8ml' },
    ],
  },
  {
    brand: 'Natura',
    name: 'Batom Faces',
    category: MAQUIAGEM,
    volume: '3.5g',
    variants: suffixed(['Nude Elegante', 'Vermelho Paixão', 'Rosa Choque', 'Coral Vibrante', 'Vinho Intenso', 'Terracota']),
  },
  {
    brand: 'Natura',
    name: 'Mamãe e Bebê',
    category: INFANTIL,
    description: 'Linha de cuidados suaves para bebês.',
    variants: [
      { suffix: 'Colônia Infantil', volume: '100ml' },
      { suffix: 'Sabonete Líquido Infantil', volume: '200ml' },
      { suffix: 'Hidratante Infantil', volume: '200ml' },
    ],
  },
  {
    brand: 'Natura',
    name: 'Naturprev',
    category: PELE,
    description: 'Linha de proteção solar.',
    variants: [
      { suffix: 'Protetor Solar Corporal FPS 30', volume: '200ml' },
      { suffix: 'Protetor Solar Facial FPS 60', volume: '50g' },
      { suffix: 'Protetor Solar Infantil FPS 60', volume: '120ml' },
      { suffix: 'Bruma Refrescante FPS 50', volume: '150ml' },
      { suffix: 'Protetor Solar em Bastão FPS 70', volume: '15g' },
    ],
  },
  {
    brand: 'Natura',
    name: 'SOU',
    category: CORPORAL,
    description: 'Linha sustentável em embalagens refil.',
    variants: [
      { suffix: 'Sabonete Líquido Refil Lavanda', volume: '200ml' },
      { suffix: 'Sabonete Líquido Refil Capim-Limão', volume: '200ml' },
      { suffix: 'Desodorante Refil Citrus', volume: '100ml' },
    ],
  },
  {
    brand: 'Natura',
    name: 'Esmalte Una',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed([
      'Vermelho Paixão',
      'Nude Elegante',
      'Rosa Bebê',
      'Vinho Intenso',
      'Azul Profundo',
      'Verde Oliva',
      'Coral Vibrante',
      'Preto Fosco',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Sabonete Líquido Tododia',
    category: HIGIENE,
    volume: '250ml',
    variants: suffixed([
      'Buriti',
      'Castanha',
      'Camomila e Aveia',
      'Jasmim',
      'Cereja',
      'Maçã Verde',
      'Ameixa',
      'Macadâmia',
      'Coco',
    ]),
  },
  {
    brand: 'Natura',
    name: 'Kriya',
    category: CORPORAL,
    description: 'Linha de bem-estar e relaxamento.',
    variants: [
      { suffix: 'Óleo de Massagem', volume: '150ml' },
      { suffix: 'Vela Aromática', volume: '120g' },
      { suffix: 'Sabonete Relaxante', volume: '100g' },
    ],
  },

  // ---------------------------------------------------------------------
  // Boticário
  // ---------------------------------------------------------------------
  {
    brand: 'Boticário',
    name: 'Malbec',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Perfume masculino amadeirado, um dos mais vendidos do Boticário.',
    variants: suffixed(['Clássico', 'Prata', 'Couro', 'Black', 'Gold', 'Fusion']),
  },
  {
    brand: 'Boticário',
    name: 'Desodorante Aerosol Malbec',
    category: CORPO_E_BANHO,
    volume: '150ml',
    variants: suffixed(['Clássico', 'Prata', 'Couro', 'Black', 'Gold', 'Fusion']),
  },
  {
    brand: 'Boticário',
    name: 'Egeo',
    category: PERFUMARIA,
    volume: '90ml',
    description: 'Fragrância doce e envolvente, popular entre o público jovem.',
    variants: suffixed([
      'Dolce',
      'Blue',
      'Nero',
      'Basic',
      'Resort',
      'Cyclos',
      'On',
      'Vanilla Colônia',
      'Woman',
      'Man',
      'Red',
      'Chuva de Prata',
    ]),
  },
  {
    brand: 'Boticário',
    name: 'Desodorante Colônia Egeo',
    category: CORPO_E_BANHO,
    volume: '200ml',
    variants: suffixed(['Dolce', 'Blue', 'Nero', 'Basic', 'Resort', 'Cyclos', 'On', 'Vanilla Colônia']),
  },
  {
    brand: 'Boticário',
    name: 'Lily',
    category: PERFUMARIA,
    volume: '75ml',
    description: 'Perfume feminino floral frutado, ícone do Boticário.',
    variants: suffixed(['Classic', 'Essence', 'Blanc', 'Bloom', 'Fleur']),
  },
  {
    brand: 'Boticário',
    name: 'Coffee',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Woman', 'Man', 'Intense', 'Woman Sedução']),
  },
  {
    brand: 'Boticário',
    name: 'Glamour',
    category: PERFUMARIA,
    volume: '75ml',
    variants: suffixed(['Clássico', 'Sedução', 'Arty', 'Blue', 'Excess']),
  },
  {
    brand: 'Boticário',
    name: 'Match',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Clássico', 'Fusion', 'Denim']),
  },
  {
    brand: 'Boticário',
    name: 'Floratta',
    category: PERFUMARIA,
    volume: '75ml',
    variants: suffixed(['Blue', 'Red', 'Pink', 'Gold', 'Purple', 'Vanilla']),
  },
  {
    brand: 'Boticário',
    name: 'Desodorante Colônia Floratta',
    category: CORPO_E_BANHO,
    volume: '200ml',
    variants: suffixed(['Blue', 'Red', 'Pink', 'Gold', 'Purple', 'Vanilla']),
  },
  {
    brand: 'Boticário',
    name: 'Hidratante Nativa Spa',
    category: CORPORAL,
    volume: '400ml',
    description: 'Linha de cuidados corporais com ativos naturais.',
    variants: suffixed(['Ameixa', 'Rosas', 'Cacau', 'Quinoa', 'Karité', 'Macadâmia', 'Banana', 'Cereja', 'Óleo de Coco']),
  },
  {
    brand: 'Boticário',
    name: 'Sabonete Nativa Spa',
    category: HIGIENE,
    volume: '100g',
    variants: suffixed(['Ameixa', 'Rosas', 'Cacau', 'Quinoa', 'Karité', 'Macadâmia']),
  },
  {
    brand: 'Boticário',
    name: 'Óleo Corporal Nativa Spa',
    category: CORPORAL,
    volume: '200ml',
    variants: suffixed(['Ameixa', 'Rosas', 'Cacau', 'Quinoa', 'Karité', 'Macadâmia', 'Banana', 'Cereja', 'Coco']),
  },
  {
    brand: 'Boticário',
    name: 'Creme para as Mãos Nativa Spa',
    category: CORPORAL,
    volume: '75g',
    variants: suffixed(['Ameixa', 'Rosas', 'Cacau', 'Quinoa', 'Karité', 'Macadâmia']),
  },
  {
    brand: 'Boticário',
    name: 'Cuide-se Bem',
    category: CORPORAL,
    description: 'Linha básica de cuidados diários.',
    variants: [
      { suffix: 'Loção Hidratante Corporal', volume: '400ml' },
      { suffix: 'Sabonete Líquido', volume: '250ml' },
      { suffix: 'Creme para as Mãos', volume: '75g' },
      { suffix: 'Óleo Desodorante Corporal', volume: '100ml' },
    ],
  },
  {
    brand: 'Boticário',
    name: 'Botica',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Original', 'Intense']),
  },
  {
    brand: 'Boticário',
    name: 'Colônia Turma da Mônica',
    category: INFANTIL,
    volume: '100ml',
    description: 'Linha infantil licenciada.',
    variants: suffixed(['- Mônica', '- Cebolinha']),
  },
  {
    brand: 'Boticário',
    name: 'Boticário Men',
    category: PELE,
    description: 'Linha de cuidados masculinos.',
    variants: [
      { suffix: 'Gel de Barbear', volume: '150ml' },
      { suffix: 'Pós-Barba Hidratante', volume: '100ml' },
      { suffix: 'Sabonete Facial', volume: '100g' },
      { suffix: 'Desodorante Aerosol', volume: '150ml' },
    ],
  },
  {
    brand: 'Boticário',
    name: 'Sol de Botica',
    category: PELE,
    description: 'Linha de proteção solar.',
    variants: [
      { suffix: 'Protetor Solar Corporal FPS 30', volume: '200ml' },
      { suffix: 'Protetor Solar Facial FPS 60', volume: '50g' },
      { suffix: 'Protetor Solar Infantil FPS 60', volume: '120ml' },
      { suffix: 'Protetor Labial FPS 30', volume: '4g' },
    ],
  },
  {
    brand: 'Boticário',
    name: 'Batom Quem Disse, Berenice?',
    category: MAQUIAGEM,
    volume: '3.5g',
    description: 'Linha de maquiagem colorida da Quem Disse, Berenice?.',
    variants: suffixed(['Nude', 'Vermelho', 'Coral', 'Rosa Choque', 'Vinho', 'Terracota']),
  },
  {
    brand: 'Boticário',
    name: 'Quem Disse, Berenice?',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Base Líquida Matte', volume: '30ml' },
      { suffix: 'Rímel Volume Extremo', volume: '8ml' },
      { suffix: 'Blush Compacto Pêssego', volume: '5g' },
      { suffix: 'Pó Compacto Translúcido', volume: '10g' },
      { suffix: 'Delineador Líquido Preto', volume: '2ml' },
    ],
  },
  {
    brand: 'Boticário',
    name: 'Esmalte Quem Disse, Berenice?',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed([
      'Vermelho Paixão',
      'Nude Elegante',
      'Azul Profundo',
      'Rosa Bebê',
      'Verde Oliva',
      'Vinho Intenso',
      'Coral Vibrante',
      'Preto Fosco',
    ]),
  },
  {
    brand: 'Boticário',
    name: 'Esmalte Louco por Cores',
    category: MAQUIAGEM,
    volume: '8ml',
    description: 'Linha de esmaltes coloridos do Boticário.',
    variants: suffixed([
      'Vermelho Paixão',
      'Nude Elegante',
      'Azul Profundo',
      'Rosa Bebê',
      'Verde Oliva',
      'Vinho Intenso',
      'Coral Vibrante',
      'Preto Fosco',
      'Amarelo Sol',
      'Lilás Suave',
    ]),
  },
  {
    brand: 'Boticário',
    name: 'O.U.i',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Woman', 'Man', 'Cologne']),
  },

  // ---------------------------------------------------------------------
  // Avon
  // ---------------------------------------------------------------------
  {
    brand: 'Avon',
    name: 'Far Away',
    category: PERFUMARIA,
    volume: '50ml',
    description: 'Perfume feminino floral oriental, um clássico da Avon.',
    variants: suffixed(['Classic', 'Segredo', 'Gold', 'Elixir']),
  },
  {
    brand: 'Avon',
    name: 'Attraction',
    category: PERFUMARIA,
    volume: '50ml',
    variants: suffixed(['Original', 'For Him']),
  },
  {
    brand: 'Avon',
    name: 'Little Black Dress',
    category: PERFUMARIA,
    volume: '50ml',
    variants: [{}],
  },
  {
    brand: 'Avon',
    name: 'Femme',
    category: PERFUMARIA,
    volume: '50ml',
    variants: [{}],
  },
  {
    brand: 'Avon',
    name: 'Incandessence',
    category: PERFUMARIA,
    volume: '50ml',
    variants: suffixed(['Original', 'Rose Gold']),
  },
  {
    brand: 'Avon',
    name: 'Pur Blanca',
    category: PERFUMARIA,
    volume: '50ml',
    variants: [{}],
  },
  {
    brand: 'Avon',
    name: 'Luck',
    category: PERFUMARIA,
    volume: '50ml',
    variants: suffixed(['For Her', 'For Him']),
  },
  {
    brand: 'Avon',
    name: 'Body Spray',
    category: CORPO_E_BANHO,
    volume: '100ml',
    description: 'Versão body spray das fragrâncias Avon mais vendidas.',
    variants: suffixed([
      'Far Away',
      'Attraction',
      'Little Black Dress',
      'Incandessence',
      'Luck',
      'Pur Blanca',
    ]),
  },
  {
    brand: 'Avon',
    name: 'Loção Hidratante',
    category: CORPORAL,
    volume: '400ml',
    variants: suffixed(['Far Away', 'Attraction']),
  },
  {
    brand: 'Avon',
    name: 'Renew',
    category: PELE,
    description: 'Linha de cuidados faciais antissinais.',
    variants: [
      { suffix: 'Creme Antissinais Dia', volume: '50g' },
      { suffix: 'Creme Antissinais Noite', volume: '50g' },
      { suffix: 'Sérum Renovador', volume: '30ml' },
      { suffix: 'Água Micelar', volume: '200ml' },
    ],
  },
  {
    brand: 'Avon',
    name: 'Anew',
    category: PELE,
    description: 'Linha premium de cuidados faciais.',
    variants: [
      { suffix: 'Creme Reafirmante', volume: '50g' },
      { suffix: 'Sérum Vitamina C', volume: '30ml' },
      { suffix: 'Creme para Área dos Olhos', volume: '15g' },
      { suffix: 'Protetor Solar Facial FPS 50', volume: '50g' },
    ],
  },
  {
    brand: 'Avon',
    name: 'Batom Color Trend',
    category: MAQUIAGEM,
    volume: '3.5g',
    variants: suffixed(['Rosa Nude', 'Vermelho Cereja', 'Coral Vibrante']),
  },
  {
    brand: 'Avon',
    name: 'Esmalte Color Trend',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed([
      'Vermelho Paixão',
      'Nude Elegante',
      'Azul Profundo',
      'Rosa Bebê',
      'Verde Oliva',
      'Vinho Intenso',
      'Coral Vibrante',
      'Preto Fosco',
    ]),
  },
  {
    brand: 'Avon',
    name: 'Color Trend',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Rímel Volume Total', volume: '8ml' },
      { suffix: 'Base Líquida Natural', volume: '30ml' },
      { suffix: 'Pó Compacto Bege', volume: '10g' },
      { suffix: 'Blush Rosa Suave', volume: '5g' },
    ],
  },
  {
    brand: 'Avon',
    name: 'Batom Avon True',
    category: MAQUIAGEM,
    volume: '3.5g',
    variants: suffixed(['Matte Nude', 'Matte Vermelho']),
  },
  {
    brand: 'Avon',
    name: 'Esmalte Avon True',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed(['Vermelho Clássico', 'Nude Rosado', 'Vinho', 'Coral', 'Azul Marinho', 'Preto']),
  },
  {
    brand: 'Avon',
    name: 'Avon True',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Base Líquida Matte', volume: '30ml' },
      { suffix: 'Máscara de Cílios', volume: '8ml' },
    ],
  },
  {
    brand: 'Avon',
    name: 'Avon Care',
    category: CORPORAL,
    description: 'Linha de cuidados corporais do dia a dia.',
    variants: [
      { suffix: 'Loção Hidratante Corporal', volume: '400ml' },
      { suffix: 'Sabonete Líquido', volume: '250ml' },
      { suffix: 'Creme para as Mãos', volume: '75g' },
      { suffix: 'Óleo Corporal', volume: '100ml' },
    ],
  },
  {
    brand: 'Avon',
    name: 'Sabonete em Barra Avon Naturals',
    category: HIGIENE,
    volume: '90g',
    variants: suffixed(['Coco', 'Amêndoas', 'Frutas Vermelhas', 'Camomila']),
  },
  {
    brand: 'Avon',
    name: 'Skin So Soft',
    category: CORPORAL,
    variants: [
      { suffix: 'Óleo Hidratante Corporal', volume: '200ml' },
      { suffix: 'Loção Hidratante Corporal', volume: '400ml' },
    ],
  },
  {
    brand: 'Avon',
    name: 'Avon Men',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Musk', 'Wild Country', 'Full Speed', 'Black Suede', 'Speed']),
  },
  {
    brand: 'Avon',
    name: 'Desodorante Aerosol Avon Men',
    category: CORPO_E_BANHO,
    volume: '150ml',
    variants: suffixed(['Musk', 'Wild Country', 'Full Speed', 'Black Suede', 'Speed']),
  },
  {
    brand: 'Avon',
    name: 'Sabonete Facial Renew',
    category: PELE,
    volume: '100g',
    variants: [{}],
  },
  {
    brand: 'Avon',
    name: 'Máscara Facial Anew',
    category: PELE,
    volume: '50g',
    variants: [{}],
  },
  {
    brand: 'Avon',
    name: 'Avon Sun',
    category: PELE,
    description: 'Linha de proteção solar.',
    variants: [
      { suffix: 'Protetor Solar Corporal FPS 30', volume: '200ml' },
      { suffix: 'Protetor Solar Facial FPS 50', volume: '50g' },
    ],
  },

  // ---------------------------------------------------------------------
  // Eudora
  // ---------------------------------------------------------------------
  {
    brand: 'Eudora',
    name: 'Shampoo Siàge',
    category: CABELOS,
    volume: '300ml',
    description: 'Linha de cuidados capilares da Eudora.',
    variants: suffixed([
      'Liso Absoluto',
      'Hidra Excellence',
      'Cronograma Capilar Reconstrução',
      'Cronograma Capilar Hidratação',
      'Cronograma Capilar Nutrição',
      'Cachos Definidos',
      'Ultraforte',
      'Anticaspa',
      'Detox Capilar',
      'Color Care',
      'Cronoshock',
    ]),
  },
  {
    brand: 'Eudora',
    name: 'Condicionador Siàge',
    category: CABELOS,
    volume: '250ml',
    variants: suffixed(['Liso Absoluto', 'Hidra Excellence', 'Cachos Definidos', 'Ultraforte']),
  },
  {
    brand: 'Eudora',
    name: 'Máscara Capilar Siàge',
    category: CABELOS,
    volume: '250g',
    variants: suffixed(['Liso Absoluto', 'Hidra Excellence', 'Cachos Definidos', 'Ultraforte']),
  },
  {
    brand: 'Eudora',
    name: 'Óleo Reparador Siàge',
    category: CABELOS,
    volume: '60ml',
    variants: [{}],
  },
  {
    brand: 'Eudora',
    name: 'Perfume',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Linha de perfumaria da Eudora.',
    variants: suffixed(['Nuah', 'Único', 'Nissi', 'EA', 'Glam', 'Duo', 'Único Prestige', 'Bela']),
  },
  {
    brand: 'Eudora',
    name: 'Body Splash',
    category: CORPO_E_BANHO,
    volume: '200ml',
    variants: suffixed(['Glam', 'Nuah', 'Nissi', 'EA', 'Único', 'Duo']),
  },
  {
    brand: 'Eudora',
    name: 'Eudora Skin',
    category: PELE,
    description: 'Linha de cuidados faciais.',
    variants: [
      { suffix: 'Sérum Facial', volume: '30ml' },
      { suffix: 'Hidratante Facial', volume: '50g' },
      { suffix: 'Água Micelar', volume: '200ml' },
      { suffix: 'Protetor Solar Facial FPS 50', volume: '50g' },
      { suffix: 'Protetor Solar Corporal FPS 30', volume: '200ml' },
      { suffix: 'Creme para as Mãos', volume: '75g' },
    ],
  },
  {
    brand: 'Eudora',
    name: 'Batom Eudora',
    category: MAQUIAGEM,
    volume: '3.5g',
    variants: suffixed(['Matte Nude', 'Cremoso Vermelho']),
  },
  {
    brand: 'Eudora',
    name: 'Esmalte Eudora',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed(['Vermelho Paixão', 'Nude Elegante', 'Rosa Bebê', 'Vinho Intenso', 'Azul Profundo', 'Preto Fosco']),
  },
  {
    brand: 'Eudora',
    name: 'Eudora Maquiagem',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Base Líquida Natural', volume: '30ml' },
      { suffix: 'Rímel Volume', volume: '8ml' },
      { suffix: 'Pó Compacto Translúcido', volume: '10g' },
      { suffix: 'Blush Rosa', volume: '5g' },
    ],
  },

  // ---------------------------------------------------------------------
  // Jequiti
  // ---------------------------------------------------------------------
  {
    brand: 'Jequiti',
    name: 'Água de Cheiro Jequiti',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Fragrância leve e refrescante para o dia a dia.',
    variants: suffixed(['Baunilha', 'Flor de Cerejeira', 'Talco', 'Alecrim', 'Frutas Vermelhas', 'Lavanda', 'Erva-Doce']),
  },
  {
    brand: 'Jequiti',
    name: 'Desodorante Colônia Água de Cheiro Jequiti',
    category: CORPO_E_BANHO,
    volume: '200ml',
    variants: suffixed(['Baunilha', 'Flor de Cerejeira', 'Talco', 'Alecrim', 'Frutas Vermelhas', 'Lavanda', 'Erva-Doce']),
  },
  {
    brand: 'Jequiti',
    name: 'Jequiti Men',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Intense', 'Sport']),
  },
  {
    brand: 'Jequiti',
    name: 'Jequiti Woman',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Clássico', 'Floral']),
  },
  {
    brand: 'Jequiti',
    name: 'Blush Rosa Blush',
    category: MAQUIAGEM,
    volume: '5g',
    description: 'Linha de maquiagem Jequiti.',
    variants: suffixed(['Compacto Rosa', 'Compacto Pêssego']),
  },
  {
    brand: 'Jequiti',
    name: 'Rosa Blush',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Batom Matte Nude', volume: '3.5g' },
      { suffix: 'Base Líquida Natural', volume: '30ml' },
      { suffix: 'Rímel Volume', volume: '8ml' },
      { suffix: 'Pó Compacto Translúcido', volume: '10g' },
    ],
  },
  {
    brand: 'Jequiti',
    name: 'Esmalte Rosa Blush',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed(['Vermelho Paixão', 'Nude Elegante', 'Rosa Bebê', 'Vinho Intenso', 'Azul Profundo', 'Preto Fosco']),
  },
  {
    brand: 'Jequiti',
    name: 'Jequiti Skin',
    category: PELE,
    variants: [
      { suffix: 'Hidratante Facial', volume: '50g' },
      { suffix: 'Sérum Facial', volume: '30ml' },
      { suffix: 'Protetor Solar FPS 50', volume: '50g' },
    ],
  },
  {
    brand: 'Jequiti',
    name: 'Sabonete em Barra Jequiti',
    category: HIGIENE,
    volume: '90g',
    variants: suffixed(['Coco', 'Aveia', 'Camomila', 'Erva-Doce']),
  },
  {
    brand: 'Jequiti',
    name: 'Hidratante Corporal Jequiti',
    category: CORPORAL,
    volume: '400ml',
    variants: suffixed(['Amêndoas', 'Coco']),
  },
  {
    brand: 'Jequiti',
    name: 'Sabonete Líquido Jequiti',
    category: HIGIENE,
    volume: '250ml',
    variants: suffixed(['Coco', 'Aveia', 'Camomila', 'Erva-Doce']),
  },
  {
    brand: 'Jequiti',
    name: 'Jequiti Sun',
    category: PELE,
    variants: [{ suffix: 'Protetor Solar Corporal FPS 30', volume: '200ml' }],
  },

  // ---------------------------------------------------------------------
  // Hinode
  // ---------------------------------------------------------------------
  {
    brand: 'Hinode',
    name: 'Bronx',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Perfume masculino amadeirado intenso.',
    variants: suffixed(['Black', 'Red', 'Blue', 'Gold']),
  },
  {
    brand: 'Hinode',
    name: 'Desodorante Aerosol Bronx',
    category: CORPO_E_BANHO,
    volume: '150ml',
    variants: suffixed(['Black', 'Red', 'Blue', 'Gold']),
  },
  {
    brand: 'Hinode',
    name: 'Único',
    category: PERFUMARIA,
    volume: '100ml',
    description: 'Perfume masculino marcante, com saída amadeirada.',
    variants: [{}, { suffix: 'Prestige' }],
  },
  {
    brand: 'Hinode',
    name: 'Nuoo',
    category: PERFUMARIA,
    volume: '100ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Fiori',
    category: PERFUMARIA,
    volume: '75ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'La Femme',
    category: PERFUMARIA,
    volume: '75ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Diva',
    category: PERFUMARIA,
    volume: '75ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Suddenly',
    category: PERFUMARIA,
    volume: '75ml',
    variants: suffixed(['Man', 'Woman', 'Rio']),
  },
  {
    brand: 'Hinode',
    name: 'Desodorante Aerosol Suddenly',
    category: CORPO_E_BANHO,
    volume: '150ml',
    variants: suffixed(['Man', 'Woman', 'Rio']),
  },
  {
    brand: 'Hinode',
    name: 'Alexandrite',
    category: PERFUMARIA,
    volume: '75ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Prestige',
    category: PERFUMARIA,
    volume: '100ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Vip',
    category: PERFUMARIA,
    volume: '100ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Alecrim Hinode',
    category: PERFUMARIA,
    volume: '75ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Charm',
    category: PERFUMARIA,
    volume: '75ml',
    variants: [{}],
  },
  {
    brand: 'Hinode',
    name: 'Colônia Hinode Men',
    category: PERFUMARIA,
    volume: '100ml',
    variants: suffixed(['Intense', 'Sport']),
  },
  {
    brand: 'Hinode',
    name: 'Hinode Men',
    category: PELE,
    description: 'Linha de cuidados masculinos.',
    variants: [
      { suffix: 'Pós-Barba Hidratante', volume: '100ml' },
      { suffix: 'Gel de Banho', volume: '200ml' },
    ],
  },
  {
    brand: 'Hinode',
    name: 'Batom Hinode',
    category: MAQUIAGEM,
    volume: '3.5g',
    variants: suffixed(['Matte Nude', 'Matte Vermelho']),
  },
  {
    brand: 'Hinode',
    name: 'Esmalte Hinode',
    category: MAQUIAGEM,
    volume: '8ml',
    variants: suffixed(['Vermelho Paixão', 'Nude Elegante', 'Rosa Bebê', 'Vinho Intenso', 'Preto Fosco']),
  },
  {
    brand: 'Hinode',
    name: 'Hinode Maquiagem',
    category: MAQUIAGEM,
    variants: [
      { suffix: 'Base Líquida Natural', volume: '30ml' },
      { suffix: 'Hidratante Facial', volume: '50g' },
    ],
  },
];

export const CATALOG_SEED_DATA: CatalogSeedEntry[] = PRODUCT_FAMILIES.flatMap(expandFamily);
