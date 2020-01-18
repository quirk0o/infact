import { lazyPropertyDescriptor, propertyDescriptor } from './object'
import { generator, Generator, GeneratorResult, take } from './generator'
import { concat, concatAll, isObject, mergeAll, path } from './util'
import {
  AfterCallback,
  AttributeDefinition,
  AttributesOf,
  AttributeType,
  Dict,
  OptionsOf,
  PropertyDefinition,
  SequenceDefinition,
  TraitFactory,
  TransientDefinition
} from './types'
import { Trait } from './trait'

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
    private traits: Record<string, Trait<Partial<TRes>, Partial<TTrans>>> = {},
    private attributes: AttributeDefinition<TRes, TTrans>[] = [],
    private callbacks: AfterCallback<TRes, TTrans>[] = []
  ) {}

  compose<F extends Factory<any, any>>(
    factory: F
  ): Factory<TRes & AttributesOf<F>, TTrans & OptionsOf<F>> {
    type AF = AttributesOf<F>
    type AO = OptionsOf<F>
    type AR = TRes & AF
    type OR = TTrans & AO
    return new Factory<AR, OR>(
      Object.assign({}, this.traits, factory.traits),
      concat<AttributeDefinition<TRes, TTrans>, any, AR>(this.attributes, factory.attributes),
      concat<AfterCallback<TRes, TTrans>, AfterCallback<any, any>, AfterCallback<AR, OR>>(
        this.callbacks,
        factory.callbacks
      )
    )
  }

  build(...traitsAndOverrides: ((TRes & TTrans) | string)[]): TRes {
    return this.gen(...traitsAndOverrides).next().value
  }

  gen(...traitsAndOverrides: ((TRes & TTrans) | string)[]): Generator<TRes, TRes & TTrans> {
    const overrides = (isObject(traitsAndOverrides[traitsAndOverrides.length - 1])
      ? traitsAndOverrides[traitsAndOverrides.length - 1]
      : {}) as TRes & TTrans
    const traits = traitsAndOverrides.slice(0, traitsAndOverrides.length - 1) as string[]

    return generator<TRes, TRes & TTrans>(nextOverrides =>
      this.doGen(traits, this.attributes, this.callbacks, nextOverrides || overrides)
    )
  }

  private doGen(
    traits: string[],
    attributes: AttributeDefinition<TRes, TTrans>[] = [],
    callbacks: AfterCallback<TRes, TTrans>[] = [],
    overrides?: TRes & TTrans
  ): GeneratorResult<TRes, TRes & TTrans> {
    let evaluator: TRes & TTrans

    const attributesWithTraits = concatAll<
      AttributeDefinition<TRes, TTrans>,
      AttributeDefinition<Partial<TRes>, Partial<TTrans>>,
      AttributeDefinition<TRes, TTrans>
    >(attributes, ...traits.map(name => this.traits[name].attributes))

    const options = descriptors(transientDefs(attributesWithTraits), () => evaluator, overrides)
    const sequences = sequenceDescriptors(
      sequenceDefs(attributesWithTraits),
      () => evaluator,
      overrides
    )
    const properties = descriptors(propertyDefs(attributesWithTraits), () => evaluator, overrides)

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
          traits,
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

  buildList(n: number, ...traitsAndOverrides: ((TRes & TTrans) | string)[]): TRes[] {
    return take(n)(this.gen(...traitsAndOverrides))
  }

  seq<K extends keyof TRes>(
    key: K
  ): (definition: (n: number, attrs: TRes & TTrans) => TRes[K]) => Factory<TRes, TTrans> {
    return definition => {
      return new Factory(
        this.traits,
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
        this.traits,
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
        this.traits,
        this.attributes.concat({ type: AttributeType.Property, key, get: definition }),
        this.callbacks
      )
    }
  }

  trait(name: string) {
    return (
      trait: Trait<Partial<TRes>, Partial<TTrans>> | TraitFactory<this>
    ): Factory<TRes, TTrans> =>
      new Factory(
        Object.assign({}, this.traits, {
          [name]: trait instanceof Trait ? trait : trait(new Trait())
        }) as Record<string, Trait<Partial<TRes>, Partial<TTrans>>>,
        this.attributes,
        this.callbacks
      )
  }

  after(callback: AfterCallback<TRes, TTrans>): Factory<TRes, TTrans> {
    return new Factory(this.traits, this.attributes, this.callbacks.concat(callback))
  }
}
