import type {
  CreateProductInput,
  ListProductsQuery,
  ProductSuggestion,
  SearchProductsInput,
  UpdateProductInput,
} from '@lotea/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Product } from '../../generated/prisma/client.ts';
import { NotFoundError } from '../../shared/errors/app-error';
import * as inventoryService from '../inventory/inventory.service';
import * as productsService from './products.service';

/** `defaultSalePrice` comes back from Prisma as a Decimal instance — moneySchema needs a real string, same convention as sales.controller.ts. */
function toProductResponse(product: Product) {
  return {
    ...product,
    defaultSalePrice: product.defaultSalePrice ? product.defaultSalePrice.toFixed(2) : null,
  };
}

function toSuggestion(product: Product): ProductSuggestion {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    sku: product.sku,
    volume: product.volume,
    variant: product.variant,
  };
}

export async function searchProductsHandler(
  request: FastifyRequest<{ Querystring: SearchProductsInput }>,
  reply: FastifyReply,
) {
  const products = await productsService.searchProducts(request.server.prisma, {
    userId: request.userId,
    query: request.query.query,
    limit: request.query.limit,
  });
  return reply.status(200).send({ items: products.map(toSuggestion) });
}

export async function recentProductsHandler(
  request: FastifyRequest<{ Querystring: { limit: number } }>,
  reply: FastifyReply,
) {
  const products = await productsService.getRecentlyUsedProducts(request.server.prisma, {
    userId: request.userId,
    limit: request.query.limit,
  });
  return reply.status(200).send({ items: products.map(toSuggestion) });
}

export async function createProductHandler(
  request: FastifyRequest<{ Body: CreateProductInput }>,
  reply: FastifyReply,
) {
  const result = await productsService.createProductWithDuplicateCheck(request.server.prisma, {
    userId: request.userId,
    actingUserId: request.userId,
    ...request.body,
  });

  if (!result.created) {
    return reply
      .status(200)
      .send({ duplicateCandidates: (result.duplicateCandidates ?? []).map(toSuggestion) });
  }
  return reply.status(201).send(toProductResponse(result.product!));
}

export async function listProductsHandler(
  request: FastifyRequest<{ Querystring: ListProductsQuery }>,
  reply: FastifyReply,
) {
  const result = await productsService.listProducts(request.server.prisma, {
    userId: request.userId,
    page: request.query.page,
    limit: request.query.limit,
    query: request.query.query,
    brand: request.query.brand,
  });
  return reply.status(200).send(result);
}

export async function getBrandsHandler(request: FastifyRequest, reply: FastifyReply) {
  const brands = await productsService.getBrands(request.server.prisma, { userId: request.userId });
  return reply.status(200).send({ brands });
}

export async function getProductHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const product = await productsService.getProductById(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
  });
  if (!product) {
    throw new NotFoundError(`Product ${request.params.id} not found`);
  }
  return reply.status(200).send(toProductResponse(product));
}

export async function updateProductHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateProductInput }>,
  reply: FastifyReply,
) {
  const product = await productsService.updateProduct(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
    actingUserId: request.userId,
    ...request.body,
  });
  return reply.status(200).send(toProductResponse(product));
}

export async function getAvailableInventoryHandler(
  request: FastifyRequest<{ Params: { id: string }; Querystring: { limit: number } }>,
  reply: FastifyReply,
) {
  const product = await productsService.getProductById(request.server.prisma, {
    id: request.params.id,
    userId: request.userId,
  });
  if (!product) {
    throw new NotFoundError(`Product ${request.params.id} not found`);
  }

  const { items, total } = await inventoryService.listAvailableForProduct(request.server.prisma, {
    userId: request.userId,
    productId: request.params.id,
    limit: request.query.limit,
  });

  return reply.status(200).send({
    items: items.map((item) => ({
      id: item.id,
      lotId: item.lotId,
      acquisitionCost: item.acquisitionCost.toFixed(2),
      expiresAt: item.expiresAt,
    })),
    total,
  });
}
