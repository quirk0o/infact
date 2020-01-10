type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>
type AnyClass<T extends object = any> = { new (): T }

type AfterCallback<A, O, R extends A = A> = (
  entity: A,
  evaluator: A & O
) => R | void
type Definition<A, O, R extends A[keyof A]> = (attrs: Partial<A & O>) => R
type OptionDefinition<O, R extends O[keyof O]> = () => R
type SequenceDefinition<A, R extends A[keyof A]> = (n: number) => R

export class Factory<A = Record<string, any>, O = Record<string, any>> {
  private attributes: {
    key: keyof A
    definition: Definition<A, O, any>
  }[] = []
  private options: {
    key: keyof O
    definition: OptionDefinition<O, any>
  }[] = []
  private sequences: {
    key: keyof A
    definition: SequenceDefinition<A, any>
    seq: number
  }[] = []
  private afterCallbacks: AfterCallback<A, O>[] = []

  static create<A = Record<string, any>, O = Record<string, any>>() {
    return new Factory<A, O>()
  }

  static compose<A = Record<string, any>, O = Record<string, any>>(
    ...factories: Factory<Partial<A>, Partial<O>>[]
  ) {
    return Factory.create<A, O>().compose(...factories)
  }

  constructor() {}

  compose(...factories: Factory<Partial<A>, Partial<O>>[]): this {
    this.attributes = this.attributes.concat(
      ...factories.map(f => f.attributes)
    )
    this.sequences = this.sequences.concat(...factories.map(f => f.sequences))
    this.options = this.options.concat(...factories.map(f => f.options))
    return this
  }

  build(overrides?: A & O): A {
    let optionsProperties = this.options
      .map(({ key, definition }) =>
        overrides && overrides[key] !== undefined
          ? {
              [key]: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: overrides[key]
              }
            }
          : {
              [key]: {
                enumerable: true,
                configurable: false,
                get: () => definition()
              }
            }
      )
      .reduce((map, descriptor) => Object.assign(map, descriptor), {})

    const sequenceProperties = this.sequences
      .map(({ key, definition, seq }) =>
        overrides && overrides[key] !== undefined
          ? {
              [key]: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: overrides[key]
              }
            }
          : {
              [key]: {
                enumerable: true,
                configurable: false,
                get: () => definition(seq)
              }
            }
      )
      .reduce((map, descriptor) => Object.assign(map, descriptor), {})
    this.sequences.forEach(sequence => sequence.seq++)

    let evaluator: A & O
    const properties = this.attributes
      .map(({ key, definition }) =>
        overrides && overrides[key] !== undefined
          ? {
              [key]: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: overrides[key]
              }
            }
          : {
              [key]: {
                enumerable: true,
                configurable: false,
                get: () => definition(evaluator)
              }
            }
      )
      .reduce((map, descriptor) => Object.assign(map, descriptor), {})

    const entityProperties = Object.assign({}, properties, sequenceProperties)
    const evaluatorProperties = Object.assign(
      {},
      entityProperties,
      optionsProperties
    )
    evaluator = Object.create(null, evaluatorProperties)

    const entity = Object.create(null, entityProperties)
    const modifiedEntity = this.afterCallbacks.reduce(
      (newEntity, callback) => callback(newEntity, evaluator),
      entity
    )

    return modifiedEntity || entity
  }

  buildList(n: number, overrides?: A & O): A[] {
    return Array(n)
      .fill(null)
      .map(() => this.build(overrides))
  }

  sequence<T extends A[keyof A]>(
    key: keyof A
  ): (definition: SequenceDefinition<A, T>) => this {
    return definition => {
      this.sequences.push({ key, definition, seq: 0 })
      return this
    }
  }

  option<T extends O[keyof O]>(
    key: keyof O
  ): (definition: OptionDefinition<O, T>) => this {
    return definition => {
      this.options.push({ key, definition })
      return this
    }
  }

  attr<T extends A[keyof A]>(
    key: keyof A
  ): (definition: Definition<A, O, T>) => this {
    return definition => {
      this.attributes.push({ key, definition })
      return this
    }
  }

  trait(): this {
    return this
  }

  after(callback: AfterCallback<A, O>): this {
    this.afterCallbacks.push(callback)
    return this
  }
}
