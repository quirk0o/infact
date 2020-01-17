# Infact

Infact is a JavaScript library for creating object factories that can be used for tests or mock servers.
It's written in TypeScript and provides typings out of the box.
Inspired heavily by [factory_bot](https://github.com/thoughtbot/factory_bot).

## Installation

```bash
npm install --save-dev @quirk0.o/infact
```

or

```bash
yarn install --save-dev @quirk0.o/infact
```

## Usage

### Basic usage

```js
const CatFactory = Factory.create()
  .seq('id')(n => n)
  .attr('name')(() => 'Fluffy')

const fluffy = CatFactory.build()
// { id: 0, name: 'Fluffy' }

const fluffies = CatFactory.buildList(2)
// [{ id: 0, name: 'Fluffy' }, { id: 1, name: 'Fluffy' }]
```

### Creating a factory

Below methods are equivalent.

```js
const CatFactory = new Factory()
const DogFactory = Factory.create()
```

### Building objects

You can build a single entity or an array of entities. Each time `buildList` is called all sequences are restarted.

```js
const CatFactory = Factory.create().attr('name')(() => 'Fluffy')

const cat = CatFactory.build()
// { name: 'Fluffy' }
const cats = CatFactory.buildList(3)
// [{ name: 'Fluffy' }, { name: 'Fluffy' }, { name: 'Fluffy' }]
```

### Attributes

To define a static attribute on the object provide a string key and a function that returns the value of the attribute.
If you want to make sure that the attribute is never modified you can also use `Object.freeze` as a safety precaution.

```js
const CatFactory = Factory.create()
  .attr('name')(() => 'Fury')
  .attr('age')(() => 4)
  .attr('meta')(() => Object.freeze({ color: 'black', gait: 'lively' }))
```

You can also override attributes by passing them to `build`.

```js
const CatFactory = Factory.create()
  .attr('name')(() => 'Fury')
  .attr('age')(() => 3)

const cat = CatFactory.build({ age: 4 })
// { name: 'Fury', age: 4 }
```

NOTE: Each call to `attr` returns a new factory so this will not work:

```js
const CatFactory = Factory.create()
CatFactory.attr('name')(() => 'Fury')
```

`CatFactory` will have no attributes in this case.

### Sequences

Sequence attributes are incremented when building multiple objects.

```js
const CatFactory = Factory.create().seq('name')(n => `Cat #${n + 1}`)

const cats = CatFactory.buildList(2)
// [{ name: 'Cat #1' }, { name: 'Cat #1 }]
```

Note that sequences will not be incremented when building a single object. For this usage check [Advanced Usage](#advanced-usage).

```js
const CatFactory = Factory.create()

CatFactory.build()
// { name: 'Cat #1' }

CatFactory.build()
// { name: 'Cat #1' }
```

### Transient attributes

These are attributes that will not be put on the resulting object but will be available as an argument to all the attribute and sequence functions.
You can also override options just like attributes by passing them to `build`.

```js
const CatFactory = Factory.create()
  .opt('hungry')(() => false)
  .attr('name')(({ hungry }) => (hungry ? 'Fury' : 'Fluffy'))

const cat = CatFactory.build()
// { name: 'Fluffy' }
const hungryCat = CatFactory.build({ hungry: true })
// { name: 'Fury' }
```

### Composing factories

You can create more complex factories by composing multiple factories.

```js
const CatFactory = Factory.create().attr('name')(() => 'Fluffy')
const SpiderFactory = Factory.create().attr('canSwing')(() => true)

const SpiderCatFactory = Factory.compose(CatFactory, SpiderFactory)
const spiderCat = SpiderCatFactory.build()
// { name: 'Fluffy' canSwing: true }

// or
const SpiderCatFactory = CatFactory.compose(SpiderFactory)
```

### Callbacks

If you want to add properties/methods or compute something after the object is build you can use a callback.

```js
const CatFactory = Factory.create()
  .attr('name')(() => 'Fluffy')
  .after(entity => console.log(`I'm a cat named ${entity.name}`))

const cat = CatFactory.build()
// I am a cat named Fluffy
// { name: 'Fluffy' }
```

The entire object of attributes and options is also available as a second parameter to the callback.

```js
const CatFactory = Factory.create()
  .opt('hungry')(() => false)
  .attr('name')(() => 'Fluffy')
  .after((entity, evaluator) =>
    console.log(
      `I'm a cat named ${entity.name} and I am ${evaluator.hungry ? 'hungry' : 'not hungry'}`
    )
  )

const cat = CatFactory.build({ hungry: true })
// I am a cat named Fluffy and I am hungry
// { name: 'Fluffy' }
```

## Advanced Usage

The method `gen` returns a generator that provides a `next` method which will return a new entity on every call.
Notice that the generator is idempotent meaning it will return the same object every time it is called. The `next` method
provides a way to iterate over the results.

```js
const CatFactory = Factory.create().seq('id')(n => n)

const catGenerator = CatFactory.gen()
catGenerator.next().value
// { id: 0 }
catGenerator.next().value
// { id: 0 }
catGenerator.next().next().value
// { id: 1 }
```
