using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class usingIsActiveInMakes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Makes_Name",
                table: "Makes");

            migrationBuilder.DropIndex(
                name: "IX_Makes_NameAr",
                table: "Makes");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Makes");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Makes",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_Makes_Name",
                table: "Makes",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Makes_NameAr",
                table: "Makes",
                column: "NameAr",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Makes_Name",
                table: "Makes");

            migrationBuilder.DropIndex(
                name: "IX_Makes_NameAr",
                table: "Makes");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Makes");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Makes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Makes_Name",
                table: "Makes",
                column: "Name",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Makes_NameAr",
                table: "Makes",
                column: "NameAr",
                unique: true,
                filter: "[IsDeleted] = 0");
        }
    }
}
