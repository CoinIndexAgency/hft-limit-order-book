import createRBTree from 'functional-red-black-tree'
import { CustomError, ERROR } from './errors'
import { Order, OrderUpdate } from './order'
import { OrderQueue } from './orderqueue'

export class OrderSide {
  private _priceTree: createRBTree.Tree<number, OrderQueue>
  private _prices: { [key: string]: OrderQueue } = {}

  private _volume = 0
  private _total = 0
  private _numOrders = 0
  private _depthSide = 0

  constructor() {
    this._priceTree = createRBTree<number, OrderQueue>()
  }

  // returns amount of orders
  len = (): number => {
    return this._numOrders
  }

  // returns depth of market
  depth = (): number => {
    return this._depthSide
  }

  // returns total amount of quantity in side
  volume = (): number => {
    return this._volume
  }

  // returns the total (size * price of each price level) in side
  total = (): number => {
    return this._total
  }

  // returns the price tree in side
  priceTree = (): createRBTree.Tree<number, OrderQueue> => {
    return this._priceTree
  }

  // appends order to definite price level
  append = (order: Order): Order => {
    const price = order.price
    const strPrice = price.toString()
    if (!this._prices[strPrice]) {
      const priceQueue = new OrderQueue(price)
      this._prices[strPrice] = priceQueue
      this._priceTree = this._priceTree.insert(price, priceQueue)
      this._depthSide += 1
    }
    this._numOrders += 1
    this._volume += order.size
    this._total += order.size * order.price
    return this._prices[strPrice].append(order)
  }

  // removes order from definite price level
  remove = (order: Order): Order => {
    const price = order.price
    const strPrice = price.toString()
    if (!this._prices[strPrice]) throw CustomError(ERROR.ErrInvalidPriceLevel)
    this._prices[strPrice].remove(order)
    if (this._prices[strPrice].len() === 0) {
      delete this._prices[strPrice]
      this._priceTree = this._priceTree.remove(price)
      this._depthSide -= 1
    }

    this._numOrders -= 1
    this._volume -= order.size
    this._total -= order.size * order.price
    return order
  }

  update = (oldOrder: Order, orderUpdate: OrderUpdate): Order | undefined => {
    if (
      orderUpdate.price !== undefined &&
      orderUpdate.price !== oldOrder.price
    ) {
      // Price changed. Remove order and update tree.
      this.remove(oldOrder)
      const newOrder = new Order(
        oldOrder.id,
        oldOrder.side,
        orderUpdate.size || oldOrder.size,
        orderUpdate.price
      )
      this.append(newOrder)
      return newOrder
    } else if (
      orderUpdate.size !== undefined &&
      orderUpdate.size !== oldOrder.size
    ) {
      // Quantity changed. Price is the same.
      const strPrice = oldOrder.price.toString()
      this._volume += orderUpdate.size - oldOrder.size
      this._total +=
        orderUpdate.size * orderUpdate.price - oldOrder.size * oldOrder.price
      this._prices[strPrice].updateOrderSize(oldOrder, orderUpdate.size)
      return oldOrder
    }
  }

  // returns maximal level of price
  maxPriceQueue = (): OrderQueue | undefined => {
    if (this._depthSide > 0) {
      const max = this._priceTree.end
      return max.value
    }
  }

  // returns maximal level of price
  minPriceQueue = (): OrderQueue | undefined => {
    if (this._depthSide > 0) {
      const min = this._priceTree.begin
      return min.value
    }
  }

  // returns nearest OrderQueue with price less than given
  lowerThan = (price: number): OrderQueue | undefined => {
    const node = this._priceTree.lt(price)
    return node.value
  }

  // returns nearest OrderQueue with price greater than given
  greaterThan = (price: number): OrderQueue | undefined => {
    const node = this._priceTree.gt(price)
    return node.value
  }

  // returns all orders
  orders = (): Order[] => {
    let orders: Order[] = []
    for (const price in this._prices) {
      if (Object.prototype.hasOwnProperty.call(this._prices, price)) {
        const allOrders = this._prices[price].toArray()
        orders = orders.concat(allOrders)
      }
    }
    return orders
  }

  toString = (): string => {
    let s = ''
    let level = this.maxPriceQueue()
    while (level) {
      s += `\n${level.price()} -> ${level.volume()}`
      level = this.lowerThan(level.price())
    }
    return s
  }
}
