import type { CatalogProductSuggestion, SearchCatalogInput } from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { CatalogProduct } from '../../generated/prisma/client';
import * as catalogService from './catalog.service';

function toSuggestion(catalogProduct: CatalogProduct): CatalogProductSuggestion {
  return {
    id: catalogProduct.id,
    brand: catalogProduct.brand,
    name: catalogProduct.name,
    category: catalogProduct.category,
    volume: catalogProduct.volume,
    description: catalogProduct.description,
    imageUrl: catalogProduct.imageUrl,
  };
}

export async function searchCatalogHandler(
  request: FastifyRequest<{ Querystring: SearchCatalogInput }>,
  reply: FastifyReply,
) {
  const catalogProducts = await catalogService.searchCatalog(request.server.prisma, {
    query: request.query.query,
    limit: request.query.limit,
  });
  return reply.status(200).send({ items: catalogProducts.map(toSuggestion) });
}

export async function getCatalogProductHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const catalogProduct = await catalogService.getActiveCatalogProduct(request.server.prisma, {
    id: request.params.id,
  });
  return reply.status(200).send(catalogProduct);
}
