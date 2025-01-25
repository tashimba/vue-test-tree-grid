export default class TreeStore<
  T extends { id: string | number; parent: string | number | null }
> {
  private items: T[];
  private itemsMap: Map<string | number, T>;

  constructor(items: T[]) {
    this.items = items;
    this.itemsMap = new Map(items.map((item) => [item.id, item]));
  }

  getAll(): T[] {
    return this.items;
  }

  getItem(id: string | number): T | null {
    return this.itemsMap.get(id) || null;
  }

  getChildren(id: string | number): T[] {
    return this.items.filter((item) => item.parent === id);
  }

  getAllChildren(id: string | number): T[] {
    const result: T[] = [];
    const stack = this.getChildren(id);

    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      stack.push(...this.getChildren(current.id));
    }

    return result;
  }

  // Возвращает цепочкуродительских элементов от заданного id до корневого элемента
  getAllParents(id: string | number): T[] {
    const result: T[] = [];
    let current = this.getItem(id);

    while (current && current.parent !== null) {
      current = this.getItem(current.parent);
      if (current) result.push(current);
    }

    return result.reverse();
  }

  addItem(newItem: T): void {
    if (!newItem || newItem.id == null) {
      throw new Error("Invalid item: id is required.");
    }

    this.items.push(newItem);
    this.itemsMap.set(newItem.id, newItem);
  }

  removeItem(id: string | number): void {
    const toRemove = [this.getItem(id), ...this.getAllChildren(id)].filter(
      Boolean
    ) as T[];
    toRemove.forEach((item) => {
      this.items = this.items.filter((i) => i.id !== item.id);
      this.itemsMap.delete(item.id);
    });
  }

  updateItem(updatedItem: T): void {
    if (!updatedItem || updatedItem.id == null) {
      throw new Error("Invalid item: id is required.");
    }

    const index = this.items.findIndex((item) => item.id === updatedItem.id);
    if (index === -1) {
      throw new Error(`Item with id ${updatedItem.id} not found.`);
    }
  }
}
