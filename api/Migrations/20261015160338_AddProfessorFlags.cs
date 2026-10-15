using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JiuJitsu.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessorFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPrincipalProfessor",
                table: "Students",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsProfessor",
                table: "Students",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPrincipalProfessor",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "IsProfessor",
                table: "Students");
        }
    }
}
