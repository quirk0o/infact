type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>
type AnyClass<T extends object = any> = { new (): T }

type Definition<A, O, R extends A[keyof A]> = (attrs: Partial<A & O>) => R
type OptionDefinition<O, R extends O[keyof O]> = () => R
type SequenceDefinition<A, R extends A[keyof A]> = (n: number) => R

export class Factory<
  A = Record<string, any>,
  O = Record<string, any>,
  C extends object = object
> {
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

  static create() {
    return new Factory()
  }

  constructor() {}

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

    return Object.create(null, entityProperties)
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

  after(): this {
    return this
  }
}
