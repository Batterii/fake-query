import {util as chaiUtil, expect} from "chai";
import {FakeQuery} from "../../lib";
import {Model} from "objection";
import sinon from "sinon";

class TestModel extends Model {
	id: number;
}

describe("FakeQuery (Integration)", function() {
	let qry: FakeQuery;

	beforeEach(function() {
		qry = new FakeQuery().resolves();
		sinon.stub(TestModel, "query").returns(qry.builder);
	});

	it("supports resolving with a value", async function() {
		const value = {};
		qry.resolves(value);

		expect(await TestModel.query()).to.equal(value);
	});

	it("supports rejection with a reason", async function() {
		const reason = {};
		qry.rejects(reason);

		return TestModel.query()
			.then(() => {
				throw new Error("Promise should have rejected");
			}, (err) => {
				expect(err).to.equal(reason);
			});
	});

	it("tracks query builder method calls with stubs", async function() {
		await TestModel.query()
			.delete()
			.where("id", ">", 42)
			.returning("*");

		expect(qry.stubNames).to.deep.equal(["delete", "where", "returning"]);
		expect(qry.stubs.delete).to.be.calledOnce;
		expect(qry.stubs.delete).to.be.calledOn(qry.builder);
		expect(qry.stubs.delete).to.be.calledWithExactly();
		expect(qry.stubs.where).to.be.calledOnce;
		expect(qry.stubs.where).to.be.calledOn(qry.builder);
		expect(qry.stubs.where).to.be.calledWithExactly("id", ">", 42);
		expect(qry.stubs.returning).to.be.calledOnce;
		expect(qry.stubs.returning).to.be.calledOn(qry.builder);
		expect(qry.stubs.returning).to.be.calledWithExactly("*");
	});

	it("throws if any builder methods are called with a different this value", function() {
		const builder = TestModel.query().where("id", ">", 42);

		expect(() => {
			builder.where.call({}, "id", "<", 100);
		}).to.throw(Error).that.includes({
			message: "'where' called with a different object as this",
		});
	});

	it("throws on any builder method calls after execution", async function() {
		const builder = TestModel.query();
		await builder;

		expect(() => {
			builder.findById(42);
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("throws on resolution value change after execution", async function() {
		await TestModel.query();

		expect(() => {
			qry.resolves({});
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("throws on rejection value change after execution", async function() {
		await TestModel.query();

		expect(() => {
			qry.rejects({});
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("reports builder stub names to chai inspect", function() {
		TestModel.query()
			.update()
			.where("id", "<", 42);

		expect(chaiUtil.inspect(qry.builder)).to.equal(
			"{ FakeQuery.builder [ update, where ] }",
		);
	});

	it("tracks toKnexQuery calls separately, with its own return value", function() {
		const result = TestModel.query().toKnexQuery();

		expect(qry.stubs).to.be.empty;
		expect(result).to.equal(qry.knexQuery);
	});

	it("throws if toKnexQuery is invoked after execution", async function() {
		const builder = TestModel.query();
		await builder;

		expect(() => {
			builder.toKnexQuery();
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("throws on any builder method calls after invoking toKnexQuery", function() {
		const builder = TestModel.query();
		builder.toKnexQuery();

		expect(() => {
			builder.where({id: 42});
		}).to.throw(Error).that.includes({
			message: "Fake query has already been converted to a knex query",
		});
	});

	it("throws if toKnexQuery is called with a different object as this", function() {
		const builder = TestModel.query();

		expect(() => {
			builder.toKnexQuery.call({});
		}).to.throw(Error).that.includes({
			message: "toKnexQuery called with a different object as this",
		});
	});
});
