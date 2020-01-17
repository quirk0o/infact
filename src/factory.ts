import { lazyPropertyDescriptor, propertyDescriptor } from './object'
import { generator, Generator, GeneratorResult, take } from './generator'
import { mergeAll, path } from './util'

type Dict = { [key: string]: any }

type AfterCallback<TRes, TTrans, R extends TRes = TRes> = (
  entity: TRes,
  evaluator: TRes & TTrans
) => R

enum AttributeType {
  Sequence = 'SEQ',
  Property = 'PROP',
  Transient = 'TRANS'
}

type AttributeDefinition<TRes = Dict, TTrans = Dict> =
  | PropertyDefinition<TRes, TTrans>
  | SequenceDefinition<TRes, TTrans>
  | TransientDefinition<TRes, TTrans>

type PropertyDefinition<TRes = Dict, TTrans = Dict> = {
  type: AttributeType.Property
  key: keyof TRes
  get: (attrs: TRes & TTrans) => TRes[keyof TRes]
}
type SequenceDefinition<TRes = Dict, TTrans = Dict> = {
  type: AttributeType.Sequence
  key: keyof TRes
  get: (n: number, attrs: TRes & TTrans) => TRes[keyof TRes]
  seq: number
}
type TransientDefinition<TRes = Dict, TTrans = Dict> = {
  type: AttributeType.Transient
  key: keyof TTrans
  get: (attrs: TRes & TTrans) => TTrans[keyof TTrans]
}

type AttributesOf<F> = F extends Factory<infer A, any> ? A : never
type OptionsOf<F> = F extends Factory<any, infer O> ? O : never

const isSequence = <TRes, TTrans>(
  attribute: AttributeDefinition<TRes, TTrans>
): attribute is SequenceDefinition<TRes, TTrans> => attribute.type === AttributeType.Sequence
const isProperty = <TRes, TTrans>(
  attribute: AttributeDefinition<TRes, TTrans>
): attribute is PropertyDefinition<TRes, TTrans> => attribute.type === AttributeType.Property
const isTransient = <TRes, TTrans>(
  attribute: AttributeDefinition<TRes, TTrans>
): attribute is TransientDefinition<TRes, TTrans> => attribute.type === AttributeType.Transient

const createDescriptor = <TRes extends object = Dict, TTrans extends object = Dict>(
  key: keyof (TRes & TTrans),
  get: () => any,
  overrides?: TRes & TTrans
) =>
  path([key])(overrides)
    ? propertyDescriptor(key, overrides![key])
    : lazyPropertyDescriptor(key, get)

const sequenceDefs = <F extends Factory>(attributes: AttributesOf<F>) =>
  attributes.filter(isSequence)
const propertyDefs = <F extends Factory>(attributes: AttributesOf<F>) =>
  attributes.filter(isProperty)
const transientDefs = <F extends Factory>(attributes: AttributesOf<F>) =>
  attributes.filter(isTransient)

const descriptors = <TRes extends object = Dict, TTrans extends object = Dict>(
  attributes: (PropertyDefinition<TRes, TTrans> | TransientDefinition<TRes, TTrans>)[],
  evaluator: () => TRes & TTrans,
  overrides?: TRes & TTrans
) =>
  attributes.map(({ key, get }) =>
    createDescriptor<TRes, TTrans>(key, () => get(evaluator()), overrides)
  )
const sequenceDescriptors = <TRes extends object = Dict, TTrans extends object = Dict>(
  attributes: SequenceDefinition<TRes, TTrans>[],
  evaluator: () => TRes & TTrans,
  overrides?: TRes & TTrans
) =>
  attributes.map(({ key, get, seq }) =>
    createDescriptor<TRes, TTrans>(key, () => get(seq, evaluator()), overrides)
  )

export class Factory<TRes extends object = Dict, TTrans extends object = Dict> {
  static AttributeType = AttributeType

  static create<TRes extends object = Dict, TTrans extends object = Dict>() {
    return new Factory<TRes, TTrans>()
  }

  static compose<TRes extends object = Dict, TTrans extends object = Dict>(
    ...factories: Factory<Partial<TRes>, Partial<TTrans>>[]
  ) {
    return factories.reduce((composedFactory, factory) => composedFactory.compose(factory))
  }

  constructor(
    private attributes: AttributeDefinition<TRes, TTrans>[] = [],
    private callbacks: AfterCallback<TRes, TTrans>[] = []
  ) {}

  compose<F extends Factory<any, any>>(
    factory: F
  ): Factory<TRes & AttributesOf<F>, TTrans & OptionsOf<F>> {
    type AF = AttributesOf<F>
    type AO = OptionsOf<F>
    type AR = TRes & AttributesOf<F>
    type OR = TTrans & OptionsOf<F>
    return new Factory<AR, OR>(
      (this.attributes as (
        | AttributeDefinition<TRes, TTrans>
        | AttributeDefinition<AF, AO>
      )[]).concat(factory.attributes),
      (this.callbacks as (AfterCallback<TRes, TTrans> | AfterCallback<AF, AO>)[]).concat(
        factory.callbacks
      ) as AfterCallback<AR, OR>[]
    )
  }

  buildOne(overrides?: TRes & TTrans): TRes {
    return this.gen(overrides).next().value
  }

  gen(overrides?: TRes & TTrans): Generator<TRes, TRes & TTrans> {
    return generator<TRes, TRes & TTrans>(nextOverrides =>
      this.doGen(this.attributes, this.callbacks, nextOverrides || overrides)
    )
  }

  private doGen(
    attributes: AttributeDefinition<TRes, TTrans>[] = [],
    callbacks: AfterCallback<TRes, TTrans>[] = [],
    overrides?: TRes & TTrans
  ): GeneratorResult<TRes, TRes & TTrans> {
    let evaluator: TRes & TTrans

    const options = descriptors(transientDefs(attributes), () => evaluator, overrides)
    const sequences = sequenceDescriptors(sequenceDefs(attributes), () => evaluator, overrides)
    const properties = descriptors(propertyDefs(attributes), () => evaluator, overrides)

    const entityDescriptorMap = Object.assign({}, mergeAll(...properties), mergeAll(...sequences))
    const evaluatorDescriptorMap = Object.assign({}, entityDescriptorMap, mergeAll(...options))
    evaluator = Object.create(null, evaluatorDescriptorMap)

    const entity = Object.create(null, entityDescriptorMap)
    const modifiedEntity = callbacks.reduce(
      (newEntity, callback) => callback(newEntity, evaluator),
      entity
    )

    return {
      value: modifiedEntity,
      next: nextOverrides =>
        this.doGen(
          attributes.map(attr =>
            isSequence(attr)
              ? {
                  ...attr,
                  seq: attr.seq + 1
                }
              : attr
          ),
          callbacks,
          nextOverrides || overrides
        )
    }
  }

  buildList(n: number, overrides?: TRes & TTrans): TRes[] {
    return take(n)(this.gen(overrides))
  }

  seq<K extends keyof TRes>(
    key: K
  ): (definition: (n: number, attrs: TRes & TTrans) => TRes[K]) => Factory<TRes, TTrans> {
    return definition => {
      return new Factory(
        this.attributes.concat({ type: AttributeType.Sequence, key, get: definition, seq: 0 }),
        this.callbacks
      )
    }
  }

  opt<K extends keyof TTrans>(
    key: K
  ): (definition: (attrs: TRes & TTrans) => TTrans[K]) => Factory<TRes, TTrans> {
    return definition => {
      return new Factory(
        this.attributes.concat({ type: AttributeType.Transient, key, get: definition }),
        this.callbacks
      )
    }
  }

  attr<K extends keyof TRes>(
    key: K
  ): (definition: (attrs: TRes & TTrans) => TRes[K]) => Factory<TRes, TTrans> {
    return definition => {
      return new Factory(
        this.attributes.concat({ type: AttributeType.Property, key, get: definition }),
        this.callbacks
      )
    }
  }

  trait(): this {
    return this
  }

  after(callback: AfterCallback<TRes, TTrans>): Factory<TRes, TTrans> {
    return new Factory(this.attributes, this.callbacks.concat(callback))
  }
}
