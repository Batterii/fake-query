# @batterii/fake-query
This module exposes a fake [Objection][1] query builder for unit tests. It is
built using [Sinon][2] and is intended to be used in conjunction with it.

# The FakeQuery Class
A named export of this module, the `FakeQuery` exposes a fake QueryBuilder
instance on its `builder` property. You can inject the fake into your code under
test by stubbing the static `::query` method on the desired model.

The fake builder automatically creates sinon stubs for any property accessed on
the builder, except for the `#then` and `#catch` methods used to execute the
query and obtain its result, as well as the `#inspect` method which prints out
a string representation of the builder.

Created stubs always return `this`, as all QueryBuilder methods are chainable.
Test code can examine the `stubNames` and `stubs` properties to write assertions
about the query. Typically, you will want to do a deep equal assertion on the
stub names, followed by sinon assertions on the stubs themselves.

By default, the fake builder will neither resolve or reject when executed, as is
normal for sinon stubs. If you want it to resolve or reject, simply involve the
`#resolves` or `#rejects` methods with the desired result value.

Once the fake builder has been executed, it can no longer be changed. If any of
its instance methods are invoked, or if you attempt to change its result with
`#resolves` or `#rejects`, the invoked method will throw. This ensures that your
assertions are always referring to the state of the builder when it was
executed, and not after.

The builder also inludes a pre-made stub for `#toKnexQuery`, which will return
an empty object typed as `any` and likewise put the builder into a state where
it can no longer be changed. This is intended to be used when testing query
builders that are nested inside other query builders using knex methods that
accept subqueries, such as `whereExists` or `innerJoin`.

# Example (Using TypeScript, Mocha, and Chai)
```ts
import { FakeQuery } from '@batterii/fake-query';
import { MyModel } from '../path/to/my-model';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);
const { expect } = chai;

describe('functionUnderTest', function() {
	let qry: FakeQuery;

	beforeEach(function() {
		qry = new FakeQuery();

		// Make sure this stub is cleaned up! See the `afterEach` below.
		sinon.stub(MyModel, 'query').returns(qry.builder);
	});

	afterEach(function() {
		sinon.restore();
	});

	it('deletes the things', async function() {
		const deletedThings = [];
		qry.resolves(deletedThings);

		const result = await functionUnderTest();

		expect(MyModel.query).to.be.calledOnce;
		expect(MyModel.query).to.be.calledOn(MyModel);
		expect(MyModel.query).to.be.calledWithExactly();
		expect(qry.stubNames).to.deep.equal([ 'delete', 'where', 'returning' ]);
		expect(qry.stubs.delete).to.be.calledOnce;
		expect(qry.stubs.delete).to.be.calledOn(qry.builder);
		expect(qry.stubs.delete).to.be.calledWithExactly();
		expect(qry.stubs.where).to.be.calledOnce;
		expect(qry.stubs.where).to.be.calledOn(qry.builder);
		expect(qry.stubs.where).to.be.calledWith('id', '>', 42);
		expect(qry.stubs.returning).to.be.calledOnce;
		expect(qry.stubs.returning).to.be.calledOn(qry.builder);
		expect(qry.stubs.returning).to.be.calledWith('*');
		expect(result).to.equal(deletedThings);
	});
});

// Any non-cosmetic changes to this function will cause the above test to fail.
async function functionUnderTest(): Promise<MyModel[]> {
	return MyModel.query()
		.delete()
		.where('id', '>', 42)
		.returning('*');
}
```

[1]: https://vincit.github.io/objection.js/
[2]: https://sinonjs.org/
