import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    console.log(customer_id, products)
    const customerExists = await this.customersRepository.findById(customer_id);
    if (!customerExists) {
      throw new AppError('Cliente não encontrado.');
    }

    const productExists = await this.productsRepository.findAllById(products);
    if (!productExists.length) {
      throw new AppError('Produto(s) não encontrado(s)');
    }

    const productIdsExists = productExists.map(prod => prod.id);
    const inexistsProd = products.filter(
      prod => !productIdsExists.includes(prod.id),
    );

    if (inexistsProd.length) {
      throw new AppError(`Produto ${inexistsProd[0].id} não encontrado`);
    }

    const prodNoQuantity = products.filter(
      prod =>
        productExists.filter(p => p.id === prod.id)[0].quantity < prod.quantity,
    );

    if (prodNoQuantity.length) {
      throw new AppError(
        `Quantidade ${prodNoQuantity[0].quantity} não disponível para o produto ${productExists[0].name}`,
      );
    }

    const serializeProds = products.map(prod => ({
      product_id: prod.id,
      quantity: prod.quantity,
      price: productExists.filter(p => p.id === prod.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializeProds,
    });

    const { order_products } = order;

    const orderProdQuantity = order_products.map(prod => ({
      id: prod.product_id,
      quantity:
        productExists.filter(p => p.id === prod.product_id)[0].quantity -
        prod.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProdQuantity);

    return order;
  }
}

export default CreateOrderService;
