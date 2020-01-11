type AfterCallback<A, O, R extends A = A> = (entity: A, evaluator: A & O) => R | void

type Generator<TNext, TArg> = {
  next(value?: TArg): GeneratorResult<TNext, TArg>
}
type GeneratorResult<TNext, TArg> = {
  value: TNext
  next(value?: TArg): GeneratorResult<TNext, TArg>
}

enum AttributeType {
  Sequence = 'SEQ',
  Property = 'PROP'
}

type AttributeDefinition<
  A = Record<string, any>,
  O = Record<string, any>,
  K extends keyof A = keyof A
> = PropertyDefinition<A, O, K> | SequenceDefinition<A, O, K>
type PropertyDefinition<
  A = Record<string, any>,
  O = Record<string, any>,
  K extends keyof A = keyof A
> = {
  type: AttributeType.Property
  key: K
  get: (attrs: A & O) => A[K]
}
type SequenceDefinition<
  A = Record<string, any>,
  O = Record<string, any>,
  K extends keyof A = keyof A
> = {
  type: AttributeType.Sequence
  key: K
  get: (n: number, attrs: A & O) => A[K]
  seq: number
}
type OptionDefinition<
  A = Record<string, any>,
  O = Record<string, any>,
  K extends keyof O = keyof O
> = {
  key: K
  get: (attrs: A & O) => O[K]
}

type AttributesOf<F> = F extends Factory<infer A, any> ? A : never
type OptionsOf<F> = F extends Factory<any, infer O> ? O : never

const isSequence = <A, O>(
  attribute: AttributeDefinition<A, O>
): attribute is SequenceDefinition<A, O> => attribute.type === AttributeType.Sequence
const isProperty = <A, O>(
  attribute: AttributeDefinition<A, O>
): attribute is PropertyDefinition<A, O> => attribute.type === AttributeType.Property

export class Factory<A = Record<string, any>, O = Record<string, any>> {
  static AttributeType = AttributeType

  static create<A = Record<string, any>, O = Record<string, any>>(
    attributes?: AttributeDefinition<A, O>[],
    options?: OptionDefinition<A, O>[],
    callbacks?: AfterCallback<A, O>[]
  ) {
    return new Factory<A, O>(attributes, options, callbacks)
  }

  static compose<A = Record<string, any>, O = Record<string, any>>(
    ...factories: Factory<Partial<A>, Partial<O>>[]
  ) {
    return factories.reduce((composedFactory, factory) => composedFactory.compose(factory))
  }

  constructor(
    private attributes: AttributeDefinition<A, O>[] = [],
    private options: OptionDefinition<A, O>[] = [],
    private callbacks: AfterCallback<A, O>[] = []
  ) {}

  compose<F extends Factory<any, any>>(factory: F): Factory<A & AttributesOf<F>, O & OptionsOf<F>> {
    return new Factory<A & AttributesOf<F>, O & OptionsOf<F>>(
      (this.attributes as (
        | AttributeDefinition<A, O>
        | AttributeDefinition<AttributesOf<F>, OptionsOf<F>>
      )[]).concat(factory.attributes),
      (this.options as (
        | OptionDefinition<A, O>
        | OptionDefinition<AttributesOf<F>, OptionsOf<F>>
      )[]).concat(factory.options) as OptionDefinition<A & AttributesOf<F>, O & OptionsOf<F>>[],
      (this.callbacks as (
        | AfterCallback<A, O>
        | AfterCallback<AttributesOf<F>, OptionsOf<F>>
      )[]).concat(factory.callbacks) as AfterCallback<A & AttributesOf<F>, O & OptionsOf<F>>[]
    )
  }

  buildOne(overrides?: A & O): A {
    return this.build(overrides).next().value
  }

  build(overrides?: A & O): Generator<A, A & O> {
    return {
      next: nextOverrides =>
        this.doBuild(this.attributes, this.options, this.callbacks, nextOverrides || overrides)
    }
  }

  private doBuild(
    attributes: AttributeDefinition<A, O>[] = [],
    options: OptionDefinition<A, O>[] = [],
    callbacks: AfterCallback<A, O>[] = [],
    overrides?: A & O
  ): GeneratorResult<A, A & O> {
    let evaluator: A & O

    let optionDescriptors = options
      .map(({ key, get }) =>
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
                get: () => get(evaluator)
              }
            }
      )
      .reduce((map, descriptor) => Object.assign(map, descriptor), {})

    const sequenceDescriptors = attributes
      .filter(isSequence)
      .map(({ key, get, seq }) =>
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
                get: () => get(seq, evaluator)
              }
            }
      )
      .reduce((map, descriptor) => Object.assign(map, descriptor), {})

    const propertyDescriptors = attributes
      .filter(isProperty)
      .map(({ key, get }) =>
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
                get: () => get(evaluator)
              }
            }
      )
      .reduce((map, descriptor) => Object.assign(map, descriptor), {})

    const entityDescriptorMap = Object.assign({}, propertyDescriptors, sequenceDescriptors)
    const evaluatorDescriptorMap = Object.assign({}, entityDescriptorMap, optionDescriptors)
    evaluator = Object.create(null, evaluatorDescriptorMap)

    const entity = Object.create(null, entityDescriptorMap)
    const modifiedEntity = callbacks.reduce(
      (newEntity, callback) => callback(newEntity, evaluator),
      entity
    )

    return {
      value: modifiedEntity,
      next: nextOverrides =>
        this.doBuild(
          attributes.map(attr =>
            isSequence(attr)
              ? {
                  ...attr,
                  seq: attr.seq + 1
                }
              : attr
          ),
          options,
          callbacks,
          nextOverrides || overrides
        )
    }
  }

  buildList(n: number, overrides?: A & O): A[] {
    return Array(n)
      .fill(null)
      .reduce(
        ([entities, generator]) => {
          const next = generator.next(overrides)
          const entity = next.value
          return [entities.concat(entity), next]
        },
        [[], this.build(overrides)]
      )[0]
  }

  sequence<K extends keyof A>(
    key: K
  ): (definition: (n: number, attrs: A & O) => A[K]) => Factory<A, O> {
    return definition => {
      return new Factory(
        this.attributes.concat({ type: AttributeType.Sequence, key, get: definition, seq: 0 }),
        this.options,
        this.callbacks
      )
    }
  }

  option<K extends keyof O>(key: K): (definition: (attrs: A & O) => O[K]) => Factory<A, O> {
    return definition => {
      return new Factory(
        this.attributes,
        this.options.concat({ key, get: definition }),
        this.callbacks
      )
    }
  }

  attr<K extends keyof A>(key: K): (definition: (attrs: A & O) => A[K]) => Factory<A, O> {
    return definition => {
      return new Factory(
        this.attributes.concat({ type: AttributeType.Property, key, get: definition }),
        this.options,
        this.callbacks
      )
    }
  }

  trait(): this {
    return this
  }

  after(callback: AfterCallback<A, O>): Factory<A, O> {
    return new Factory(this.attributes, this.options, this.callbacks.concat(callback))
  }
}
